import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../shared/database/database.service';
import { FlowsService } from '../flows/flows.service';
import { responseChunks, runMenu } from './whatsapp.engine';

type Inbox = { id: string; sender: string; text: string | null; sent_at: Date };
type Conversation = { flow_id: string; version: number; menu_step_id: string | null; state: string; last_inbound_at: Date };

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
        const lock = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", ['wa:' + phone + ':' + candidate.sender]);
        if (!lock.rows[0]?.acquired) return false;
        const row = await client.query<Inbox>(`SELECT id,sender,text,sent_at FROM app.whatsapp_inbox WHERE phone_number_id=$1 AND sender=$2 AND state='pending'
          ORDER BY ingest_sequence LIMIT 1 FOR UPDATE`, [phone,candidate.sender]);
        const inbound = row.rows[0];
        if (!inbound) return false;
        const channel = (await client.query<{ flow_id: string; version: number }>('SELECT flow_id,version FROM app.whatsapp_channels WHERE phone_number_id=$1 AND business_id=$2', [phone,business])).rows[0];
        const existing = (await client.query<Conversation>('SELECT flow_id,version,menu_step_id,state,last_inbound_at FROM app.whatsapp_conversations WHERE phone_number_id=$1 AND sender=$2 FOR UPDATE', [phone,inbound.sender])).rows[0];
        const age = Date.now() - inbound.sent_at.getTime();
        if (!channel || !inbound.text?.trim() || age > 85800000 || age < -300000 || existing?.state === 'paused'
          || (existing && inbound.sent_at < existing.last_inbound_at)) {
          await client.query("UPDATE app.whatsapp_inbox SET state='ignored' WHERE id=$1", [inbound.id]);
          return true;
        }
        const waiting = existing?.state === 'waiting' && inbound.sent_at.getTime() - existing.last_inbound_at.getTime() < 86400000;
        const pinned = waiting ? existing : channel;
        let result;
        try {
          const snapshot = await this.flows.publishedSnapshot(business,pinned.flow_id,pinned.version);
          result = runMenu(snapshot.steps,waiting ? existing.menu_step_id : null,inbound.text);
        } catch {
          await client.query("UPDATE app.whatsapp_inbox SET state='failed' WHERE id=$1", [inbound.id]);
          if (existing) await client.query("UPDATE app.whatsapp_conversations SET state='paused',updated_at=now() WHERE phone_number_id=$1 AND sender=$2", [phone,inbound.sender]);
          return true;
        }
        await client.query(`INSERT INTO app.whatsapp_conversations(phone_number_id,sender,business_id,flow_id,version,menu_step_id,state,last_inbound_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(phone_number_id,sender) DO UPDATE
          SET flow_id=EXCLUDED.flow_id,version=EXCLUDED.version,menu_step_id=EXCLUDED.menu_step_id,state=EXCLUDED.state,last_inbound_at=EXCLUDED.last_inbound_at,updated_at=now()`,
        [phone,inbound.sender,business,pinned.flow_id,pinned.version,result.menu,result.state,inbound.sent_at]);
        const chunks = responseChunks(result.text);
        for (const [sequence,text] of chunks.entries()) await client.query(`INSERT INTO app.whatsapp_outbox(inbox_id,sequence,phone_number_id,recipient,text,expires_at)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(inbox_id,sequence) DO NOTHING`, [inbound.id,sequence,phone,inbound.sender,text,new Date(inbound.sent_at.getTime() + 85800000)]);
        await client.query("UPDATE app.whatsapp_inbox SET state='processed' WHERE id=$1", [inbound.id]);
        return true;
      });
      if (processed) return true;
    }
    return false;
  }
}
