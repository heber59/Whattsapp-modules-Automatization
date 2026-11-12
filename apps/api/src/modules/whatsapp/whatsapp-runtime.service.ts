import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runFlow, type FlowVariables, type FlowAction } from '@wa/contracts';
import { DatabaseService } from '../../shared/database/database.service';
import { FlowsService } from '../flows/flows.service';
import { responseChunks } from './whatsapp.engine';

type Inbox = { id: string; sender: string; text: string | null; sent_at: Date };
type Conversation = { flow_id: string; version: number; menu_step_id: string | null; state: string; last_inbound_at: Date; variables: FlowVariables; operator_paused: boolean };

@Injectable()
export class WhatsAppRuntimeService {
  constructor(private readonly database: DatabaseService, private readonly flows: FlowsService, private readonly config: ConfigService) {}

  async processOne(): Promise<boolean> {
    const phone = this.config.getOrThrow<string>('META_PHONE_NUMBER_ID');
    const business = this.config.getOrThrow<string>('META_BUSINESS_ID');
    const candidates = await this.database.query<{ sender: string }>(`SELECT sender FROM app.whatsapp_inbox
      WHERE phone_number_id=$1 AND state='pending' GROUP BY sender ORDER BY min(received_at) LIMIT 10`, [phone]);
    for (const candidate of candidates.rows) {
      const processed = await this.database.transaction(async (client) => {
        const lock = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired', ['wa:' + phone + ':' + candidate.sender]);
        if (!lock.rows[0]?.acquired) return false;
        const row = await client.query<Inbox>(`SELECT id,sender,text,sent_at FROM app.whatsapp_inbox WHERE phone_number_id=$1 AND sender=$2 AND state='pending'
          ORDER BY ingest_sequence LIMIT 1 FOR UPDATE`, [phone,candidate.sender]);
        const inbound = row.rows[0];
        if (!inbound) return false;
        const channel = (await client.query<{ flow_id: string; version: number }>('SELECT flow_id,version FROM app.whatsapp_channels WHERE phone_number_id=$1 AND business_id=$2', [phone,business])).rows[0];
        const existing = (await client.query<Conversation>('SELECT flow_id,version,menu_step_id,state,last_inbound_at,variables,operator_paused FROM app.whatsapp_conversations WHERE phone_number_id=$1 AND sender=$2 FOR UPDATE', [phone,inbound.sender])).rows[0];
        const age = Date.now() - inbound.sent_at.getTime();
        if (!channel || !inbound.text?.trim() || age > 85800000 || age < -300000 || (existing && inbound.sent_at < existing.last_inbound_at)) {
          await client.query("UPDATE app.whatsapp_inbox SET state='ignored' WHERE id=$1", [inbound.id]);
          return true;
        }
        if (existing?.state === 'paused' || existing?.operator_paused) {
          await client.query('UPDATE app.whatsapp_conversations SET last_inbound_at=$3,updated_at=now() WHERE phone_number_id=$1 AND sender=$2', [phone,inbound.sender,inbound.sent_at]);
          await client.query("UPDATE app.whatsapp_inbox SET state='processed' WHERE id=$1", [inbound.id]);
          return true;
        }
        const waiting = existing?.state === 'waiting' && inbound.sent_at.getTime() - existing.last_inbound_at.getTime() < 86400000;
        const pinned = waiting ? existing : channel;
        let result;
        try {
          const snapshot = await this.flows.publishedSnapshot(business,pinned.flow_id,pinned.version);
          result = runFlow(snapshot.steps,waiting ? existing.menu_step_id : null,inbound.text,waiting ? existing.variables : {});
        } catch {
          await client.query("UPDATE app.whatsapp_inbox SET state='failed' WHERE id=$1", [inbound.id]);
          await client.query(`INSERT INTO app.whatsapp_conversations(phone_number_id,sender,business_id,flow_id,version,state,last_inbound_at)
            VALUES($1,$2,$3,$4,$5,'paused',$6) ON CONFLICT(phone_number_id,sender) DO UPDATE SET state='paused',updated_at=now()`, [phone,inbound.sender,business,pinned.flow_id,pinned.version,inbound.sent_at]);
          await client.query(`INSERT INTO app.operation_notifications(business_id,sender,inbox_id,step_id,recipient,text) VALUES($1,$2,$3,'runtime_error','owner','Flow execution failed. Review the conversation before resuming.') ON CONFLICT(inbox_id,step_id) DO NOTHING`, [business,inbound.sender,inbound.id]);
          return true;
        }
        await client.query(`INSERT INTO app.whatsapp_conversations(phone_number_id,sender,business_id,flow_id,version,menu_step_id,state,last_inbound_at,variables,operator_paused)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(phone_number_id,sender) DO UPDATE
          SET flow_id=EXCLUDED.flow_id,version=EXCLUDED.version,menu_step_id=EXCLUDED.menu_step_id,state=EXCLUDED.state,last_inbound_at=EXCLUDED.last_inbound_at,variables=EXCLUDED.variables,operator_paused=EXCLUDED.operator_paused,updated_at=now()`,
        [phone,inbound.sender,business,pinned.flow_id,pinned.version,result.currentStep,result.state,inbound.sent_at,JSON.stringify(result.variables),false]);
        let sequence = 0;
        let text: string[] = [];
        const enqueue = async (body: string, payload: Record<string, unknown> | null = null) => {
          await client.query(`INSERT INTO app.whatsapp_outbox(inbox_id,sequence,phone_number_id,recipient,text,expires_at,payload,operator_message)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(inbox_id,sequence) DO NOTHING`, [inbound.id,sequence++,phone,inbound.sender,body,new Date(inbound.sent_at.getTime()+85800000),payload || result.state === 'paused' ? JSON.stringify({ ...payload, flowPauseNotice: result.state === 'paused' }) : null,false]);
        };
        const flush = async () => { for (const chunk of responseChunks(text.join('\n\n'))) await enqueue(chunk); text = []; };
        for (const action of result.actions as FlowAction[]) {
          if (action.type === 'text') { text.push(action.text); continue; }
          if (action.type === 'document' || action.type === 'image') {
            await flush(); await enqueue(action.caption || action.filename || action.type,action);
          } else if (action.type === 'order') {
            await client.query(`INSERT INTO app.flow_orders(business_id,phone_number_id,sender,inbox_id,step_id,data,total,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(inbox_id,step_id) DO NOTHING`, [business,phone,inbound.sender,inbound.id,action.stepId,JSON.stringify(action.data),action.total ?? null,action.confirmation === 'human' ? 'pending_approval' : 'confirmed']);
          } else if (action.type === 'notify' || action.type === 'handoff') {
            const external = action.notificationChannel === 'whatsapp';
            await client.query(`INSERT INTO app.operation_notifications(business_id,sender,inbox_id,step_id,recipient,text,delivery_state,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(inbox_id,step_id) DO NOTHING`, [business,inbound.sender,inbound.id,action.stepId,action.recipient,action.text,external ? 'pending' : 'inbox',external ? JSON.stringify({templateName:action.templateName,templateLanguage:action.templateLanguage}) : null]);
          }
        }
        await flush();
        await client.query("UPDATE app.whatsapp_inbox SET state='processed' WHERE id=$1", [inbound.id]);
        return true;
      });
      if (processed) return true;
    }
    return false;
  }
}
