import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../shared/database/database.service';
import { MetaGateway } from './meta.gateway';

type Outbound = { id: string; phone_number_id: string; recipient: string; text: string; attempts: number };

@Injectable()
export class WhatsAppSenderService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService, private readonly gateway: MetaGateway) {}

  async sendOne(): Promise<boolean> {
    const phone = this.config.getOrThrow<string>('META_PHONE_NUMBER_ID');
    const business = this.config.getOrThrow<string>('META_BUSINESS_ID');
    const outbound = await this.database.transaction(async (client) => {
      // A process may die after sending but before recording the provider acknowledgement.
      const stale = await client.query<{ recipient: string }>(`UPDATE app.whatsapp_outbox SET state='manual_review',updated_at=now()
        WHERE phone_number_id=$1 AND state='sending' AND updated_at < now()-interval '2 minutes' RETURNING recipient`, [phone]);
      for (const row of stale.rows) await client.query("UPDATE app.whatsapp_conversations SET state='paused',updated_at=now() WHERE phone_number_id=$1 AND sender=$2", [phone,row.recipient]);
      await client.query("UPDATE app.whatsapp_outbox SET state='expired',updated_at=now() WHERE phone_number_id=$1 AND state='pending' AND expires_at<=now()", [phone]);
      const result = await client.query<Outbound>(`SELECT o.id,o.phone_number_id,o.recipient,o.text,o.attempts FROM app.whatsapp_outbox o
        JOIN app.whatsapp_inbox i ON i.id=o.inbox_id
        JOIN app.whatsapp_channels ch ON ch.phone_number_id=o.phone_number_id
        JOIN app.whatsapp_conversations c ON c.phone_number_id=o.phone_number_id AND c.sender=o.recipient
        WHERE o.phone_number_id=$1 AND ch.business_id=$2 AND o.state='pending' AND o.available_at<=now() AND o.expires_at>now() AND c.state<>'paused'
        AND NOT EXISTS (SELECT 1 FROM app.whatsapp_outbox prev JOIN app.whatsapp_inbox pi ON pi.id=prev.inbox_id
          WHERE prev.phone_number_id=o.phone_number_id AND prev.recipient=o.recipient AND prev.state IN ('pending','sending','manual_review')
          AND (pi.ingest_sequence,prev.sequence)<(i.ingest_sequence,o.sequence))
        ORDER BY i.ingest_sequence,o.sequence LIMIT 1 FOR UPDATE OF o SKIP LOCKED`, [phone,business]);
      const row = result.rows[0];
      if (!row) return null;
      await client.query("UPDATE app.whatsapp_outbox SET state='sending',attempts=attempts+1,updated_at=now() WHERE id=$1", [row.id]);
      return row;
    });
    if (!outbound) return false;
    const result = await this.gateway.send(phone,outbound.recipient,outbound.text);
    await this.database.transaction(async (client) => {
      if (result.state === 'sent') {
        await client.query(`UPDATE app.whatsapp_outbox SET state='sent',provider_message_id=$2,updated_at=now(),delivery_status=
          (SELECT status FROM app.whatsapp_status_events WHERE message_id=$2 ORDER BY CASE status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 ELSE 1 END DESC,event_at DESC LIMIT 1)
          WHERE id=$1 AND state='sending'`, [outbound.id,result.id]);
      } else if (result.state === 'retry' && outbound.attempts < 4) {
        await client.query("UPDATE app.whatsapp_outbox SET state='pending',available_at=now()+($2 * interval '1 second'),updated_at=now() WHERE id=$1 AND state='sending'", [outbound.id,Math.min(300,30 * 2 ** outbound.attempts)]);
      } else {
        const state = result.state === 'retry' ? 'failed' : result.state;
        await client.query("UPDATE app.whatsapp_outbox SET state=$2,updated_at=now() WHERE id=$1 AND state='sending'", [outbound.id,state]);
        await client.query("UPDATE app.whatsapp_conversations SET state='paused',updated_at=now() WHERE phone_number_id=$1 AND sender=$2", [phone,outbound.recipient]);
      }
    });
    return true;
  }
}
