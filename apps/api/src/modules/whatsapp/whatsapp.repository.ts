import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';

export interface Channel { phoneNumberId: string; businessId: string; flowId: string; version: number }
const channelFields = 'phone_number_id AS "phoneNumberId", business_id AS "businessId", flow_id AS "flowId", version';

@Injectable()
export class WhatsAppRepository {
  constructor(private readonly database: DatabaseService) {}

  async channel(business: string): Promise<Channel | null> {
    return (await this.database.query<Channel>(`SELECT ${channelFields} FROM app.whatsapp_channels WHERE business_id=$1`, [business])).rows[0] ?? null;
  }

  async configure(business: string, phone: string, flow: string, version: number): Promise<void> {
    try {
      const result = await this.database.query(`INSERT INTO app.whatsapp_channels(phone_number_id,business_id,flow_id,version)
        VALUES($1,$2,$3,$4) ON CONFLICT (phone_number_id) DO UPDATE SET flow_id=EXCLUDED.flow_id,version=EXCLUDED.version,configured_at=now()
        WHERE app.whatsapp_channels.business_id=EXCLUDED.business_id RETURNING phone_number_id`, [phone, business, flow, version]);
      if (!result.rowCount) throw new ConflictException('This pilot phone is already assigned');
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('This business already has a pilot phone');
      throw error;
    }
  }

  async ingest(phone: string, business: string, messages: { id: string; sender: string; text: string | null; sentAt: Date }[], statuses: { id: string; status: string; at: Date }[]) {
    await this.database.transaction(async (client) => {
      const known = await client.query('SELECT 1 FROM app.whatsapp_channels WHERE phone_number_id=$1 AND business_id=$2', [phone, business]);
      if (!known.rowCount) return;
      for (const message of messages) await client.query(`INSERT INTO app.whatsapp_inbox(id,phone_number_id,sender,text,sent_at)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`, [message.id, phone, message.sender, message.text, message.sentAt]);
      for (const event of statuses) {
        await client.query('INSERT INTO app.whatsapp_status_events(message_id,status,event_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [event.id, event.status, event.at]);
        await client.query(`UPDATE app.whatsapp_outbox SET delivery_status=(SELECT status FROM app.whatsapp_status_events
          WHERE message_id=$1 ORDER BY CASE status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 ELSE 1 END DESC,event_at DESC LIMIT 1)
          WHERE provider_message_id=$1 AND phone_number_id=$2`, [event.id, phone]);
        if (event.status === 'failed') await client.query(`UPDATE app.whatsapp_conversations SET state='paused',updated_at=now()
          WHERE phone_number_id=$1 AND sender IN (SELECT recipient FROM app.whatsapp_outbox
          WHERE provider_message_id=$2 AND phone_number_id=$1 AND delivery_status='failed')`, [phone,event.id]);
      }
    });
  }
}
