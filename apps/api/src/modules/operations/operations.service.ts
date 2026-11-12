import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DatabaseService } from '../../shared/database/database.service';
import type { Principal } from '../../shared/auth/auth.types';
import { BusinessesService } from '../businesses/businesses.service';

const senderSchema = z.string().regex(/^[1-9][0-9]{6,14}$/);
const actionSchema = z.object({
  type: z.enum(['reply','pause','resume','confirm_order','cancel_order','review_sent','review_discard','read_notification','notification_review_sent','notification_review_discard']),
  sender: senderSchema.optional(), id: z.string().uuid().optional(), text: z.string().trim().min(1).max(4000).optional(),
  providerMessageId: z.string().min(1).max(255).optional(),
}).strict();

@Injectable()
export class OperationsService {
  constructor(private readonly database: DatabaseService, private readonly businesses: BusinessesService) {}

  async snapshot(user: Principal, business: string) {
    await this.businesses.find(user, business);
    const [orders, conversations, notifications, deliveries] = await Promise.all([
      this.database.query(`SELECT id,sender,state,data,total::float8 AS total,currency,created_at AS "createdAt" FROM app.flow_orders WHERE business_id=$1 ORDER BY created_at DESC LIMIT 100`, [business]),
      this.database.query(`SELECT sender,state,variables,operator_paused AS "operatorPaused",updated_at AS "updatedAt",last_inbound_at AS "lastInboundAt" FROM app.whatsapp_conversations WHERE business_id=$1 ORDER BY updated_at DESC LIMIT 100`, [business]),
      this.database.query(`SELECT id,sender,recipient,text,created_at AS "createdAt",read_at AS "readAt",delivery_state AS "deliveryState",attempts,provider_message_id AS "providerMessageId" FROM app.operation_notifications WHERE business_id=$1 ORDER BY created_at DESC LIMIT 100`, [business]),
      this.database.query(`SELECT o.id,o.recipient AS sender,o.text,o.state,o.delivery_status AS "deliveryStatus",o.created_at AS "createdAt" FROM app.whatsapp_outbox o JOIN app.whatsapp_channels c USING(phone_number_id) WHERE c.business_id=$1 AND o.state IN ('failed','manual_review','expired') ORDER BY o.created_at DESC LIMIT 100`, [business]),
    ]);
    return { orders: orders.rows, conversations: conversations.rows, notifications: notifications.rows, deliveries: deliveries.rows };
  }

  async history(user: Principal, business: string, sender: string) {
    await this.businesses.find(user, business);
    if (!senderSchema.safeParse(sender).success) throw new BadRequestException('Invalid conversation sender');
    const result = await this.database.query(`SELECT * FROM (
      SELECT i.id,'inbound' AS direction,i.text,i.state,i.received_at AS "createdAt",NULL::jsonb AS payload
      FROM app.whatsapp_inbox i JOIN app.whatsapp_channels c USING(phone_number_id) WHERE c.business_id=$1 AND i.sender=$2 AND i.text IS NOT NULL AND i.id NOT LIKE 'approval.%' AND i.id NOT LIKE 'resume.%'
      UNION ALL SELECT o.id::text,'outbound',o.text,o.state,o.created_at,o.payload
      FROM app.whatsapp_outbox o JOIN app.whatsapp_channels c USING(phone_number_id) WHERE c.business_id=$1 AND o.recipient=$2
      ) history ORDER BY "createdAt" DESC LIMIT 200`, [business,sender]);
    return { messages: result.rows.reverse() };
  }

  async action(user: Principal, business: string, input: unknown) {
    const membership = await this.businesses.find(user, business);
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid operation action');
    const action = parsed.data;
    if ((action.type === 'review_sent' || action.type === 'review_discard' || action.type === 'notification_review_sent' || action.type === 'notification_review_discard') && membership.role === 'operator') throw new ForbiddenException('Owners or administrators must review delivery failures');
    await this.database.transaction(async client => {
      const channel = (await client.query<{phone_number_id:string}>('SELECT phone_number_id FROM app.whatsapp_channels WHERE business_id=$1', [business])).rows[0];
      const actionSender = action.sender ?? (action.id ? (await client.query<{sender:string}>('SELECT sender FROM app.flow_orders WHERE id=$1 AND business_id=$2', [action.id,business])).rows[0]?.sender : undefined);
      if (channel && actionSender) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['wa:'+channel.phone_number_id+':'+actionSender]);
      if (action.type === 'notification_review_sent' || action.type === 'notification_review_discard') {
        if (!action.id || (action.type === 'notification_review_sent' && !action.providerMessageId)) throw new BadRequestException('Notification ID and verified provider acknowledgement are required');
        const updated = await client.query(`UPDATE app.operation_notifications SET delivery_state=$3,provider_message_id=COALESCE($4,provider_message_id),updated_at=now() WHERE id=$1 AND business_id=$2 AND delivery_state IN ('manual_review','failed') RETURNING id`, [action.id,business,action.type === 'notification_review_sent' ? 'sent' : 'discarded',action.providerMessageId ?? null]);
        if (!updated.rowCount) throw new ConflictException('Notification is unavailable or already reviewed');
        return;
      }
      if (action.type === 'read_notification') {
        if (!action.id) throw new BadRequestException('Notification ID is required');
        const updated = await client.query('UPDATE app.operation_notifications SET read_at=now() WHERE id=$1 AND business_id=$2 RETURNING id', [action.id,business]);
        if (!updated.rowCount) throw new NotFoundException('Notification not available');
        return;
      }
      if (action.type === 'confirm_order' || action.type === 'cancel_order') {
        if (!action.id) throw new BadRequestException('Order ID is required');
        const order = (await client.query<{phone_number_id:string;sender:string;step_id:string}>(`SELECT phone_number_id,sender,step_id FROM app.flow_orders WHERE id=$1 AND business_id=$2 AND state='pending_approval' FOR UPDATE`, [action.id,business])).rows[0];
        if (!order) throw new ConflictException('Order is unavailable or already decided');
        const unresolved = await client.query(`SELECT 1 FROM app.whatsapp_outbox WHERE phone_number_id=$1 AND recipient=$2 AND state IN ('manual_review','sending','failed') LIMIT 1`, [order.phone_number_id,order.sender]);
        if (unresolved.rowCount) throw new ConflictException('Resolve uncertain or failed deliveries before deciding an order');
        const decision = action.type === 'confirm_order' ? 'confirmed' : 'cancelled';
        await client.query('UPDATE app.flow_orders SET state=$3,updated_at=now() WHERE id=$1 AND business_id=$2', [action.id,business,decision]);
        const resumed = await client.query<{last_inbound_at:Date;operator_paused:boolean}>(`UPDATE app.whatsapp_conversations SET variables=jsonb_set(variables,'{orderStatus}',to_jsonb($4::text)),state=CASE WHEN operator_paused THEN state ELSE 'waiting' END,updated_at=now() WHERE business_id=$1 AND sender=$2 AND menu_step_id=$3 AND state='paused' RETURNING last_inbound_at,operator_paused`, [business,order.sender,order.step_id,decision]);
        if (resumed.rows[0] && !resumed.rows[0].operator_paused) await client.query(`INSERT INTO app.whatsapp_inbox(id,phone_number_id,sender,text,sent_at,state) VALUES($1,$2,$3,'decision',$4,'pending')`, ['approval.'+randomUUID(),order.phone_number_id,order.sender,resumed.rows[0].last_inbound_at]);        return;
      }
      if (action.type === 'review_sent' || action.type === 'review_discard') {
        if (!action.id || (action.type === 'review_sent' && !action.providerMessageId)) throw new BadRequestException('Delivery ID and verified provider acknowledgement are required');
        const updated = await client.query(`UPDATE app.whatsapp_outbox o SET state=$3,provider_message_id=COALESCE($4,provider_message_id),updated_at=now() FROM app.whatsapp_channels c WHERE o.id=$1 AND o.phone_number_id=c.phone_number_id AND c.business_id=$2 AND o.state IN ('manual_review','failed') RETURNING o.id`, [action.id,business,action.type === 'review_sent' ? 'sent' : 'expired',action.providerMessageId ?? null]);
        if (!updated.rowCount) throw new ConflictException('Delivery is unavailable or already reviewed');
        return;
      }
      if (!action.sender) throw new BadRequestException('Conversation sender is required');
      const conversation = (await client.query<{phone_number_id:string;last_inbound_at:Date;state:string}>(`SELECT phone_number_id,last_inbound_at,state FROM app.whatsapp_conversations WHERE business_id=$1 AND sender=$2 FOR UPDATE`, [business,action.sender])).rows[0];
      if (!conversation) throw new NotFoundException('Conversation not available');
      if (action.type === 'pause') {
        await client.query(`UPDATE app.whatsapp_conversations SET operator_paused=true,updated_at=now() WHERE business_id=$1 AND sender=$2`, [business,action.sender]);
      } else if (action.type === 'resume') {
        const pendingOrder = await client.query("SELECT 1 FROM app.flow_orders WHERE business_id=$1 AND sender=$2 AND state='pending_approval' LIMIT 1", [business,action.sender]);
        if (pendingOrder.rowCount) throw new ConflictException('Decide pending orders before resuming');
        const unresolved = await client.query(`SELECT 1 FROM app.whatsapp_outbox WHERE phone_number_id=$1 AND recipient=$2 AND state IN ('manual_review','sending','failed') LIMIT 1`, [conversation.phone_number_id,action.sender]);
        if (unresolved.rowCount) throw new ConflictException('Resolve uncertain or failed deliveries before resuming');
        await client.query(`UPDATE app.whatsapp_conversations SET operator_paused=false,state=CASE WHEN menu_step_id IS NULL THEN 'completed' ELSE 'waiting' END,updated_at=now() WHERE business_id=$1 AND sender=$2`, [business,action.sender]);
        if (conversation.state === 'paused') await client.query(`INSERT INTO app.whatsapp_inbox(id,phone_number_id,sender,text,sent_at,state) VALUES($1,$2,$3,'resume',$4,'pending')`, ['resume.'+randomUUID(),conversation.phone_number_id,action.sender,conversation.last_inbound_at]);
      } else if (action.type === 'reply') {
        if (!action.text) throw new BadRequestException('Reply text is required');
        if (Date.now()-conversation.last_inbound_at.getTime() >= 85800000) throw new ConflictException('Customer messaging window has expired');
        const id = 'operator.'+randomUUID();
        await client.query(`INSERT INTO app.whatsapp_inbox(id,phone_number_id,sender,text,sent_at,state) VALUES($1,$2,$3,NULL,$4,'processed')`, [id,conversation.phone_number_id,action.sender,conversation.last_inbound_at]);
        await client.query(`INSERT INTO app.whatsapp_outbox(inbox_id,sequence,phone_number_id,recipient,text,expires_at,operator_message) VALUES($1,0,$2,$3,$4,$5,true)`, [id,conversation.phone_number_id,action.sender,action.text,new Date(conversation.last_inbound_at.getTime()+85800000)]);
        await client.query('UPDATE app.whatsapp_conversations SET operator_paused=true,updated_at=now() WHERE business_id=$1 AND sender=$2', [business,action.sender]);
      }
    });
    return { status: 'ok' as const };
  }
}
