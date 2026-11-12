import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../shared/database/database.service';
import { MetaGateway } from './meta.gateway';

type Notification = {id:string;recipient:string;text:string;attempts:number;payload:{templateName:string;templateLanguage:string}};

@Injectable()
export class NotificationSenderService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService, private readonly gateway: MetaGateway) {}

  async sendOne(): Promise<boolean> {
    const business = this.config.getOrThrow<string>('META_BUSINESS_ID');
    const phone = this.config.getOrThrow<string>('META_PHONE_NUMBER_ID');
    const notification = await this.database.transaction(async client => {
      await client.query(`UPDATE app.operation_notifications SET delivery_state='manual_review',updated_at=now() WHERE business_id=$1 AND delivery_state='sending' AND updated_at<now()-interval '2 minutes'`, [business]);
      const selected = (await client.query<Notification>(`SELECT id,recipient,text,attempts,payload FROM app.operation_notifications WHERE business_id=$1 AND delivery_state IN ('pending','retry') AND available_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [business])).rows[0];
      if (!selected) return null;
      await client.query(`UPDATE app.operation_notifications SET delivery_state='sending',attempts=attempts+1,updated_at=now() WHERE id=$1`, [selected.id]);
      return selected;
    });
    if (!notification) return false;
    const result = await this.gateway.sendTemplate(phone,notification.recipient,notification.payload.templateName,notification.payload.templateLanguage,notification.text);
    if (result.state === 'sent') {
      await this.database.query(`UPDATE app.operation_notifications SET delivery_state='sent',provider_message_id=$2,updated_at=now() WHERE id=$1 AND delivery_state='sending'`, [notification.id,result.id]);
    } else if (result.state === 'retry' && notification.attempts < 4) {
      await this.database.query(`UPDATE app.operation_notifications SET delivery_state='retry',available_at=now()+($2 * interval '1 second'),updated_at=now() WHERE id=$1 AND delivery_state='sending'`, [notification.id,Math.min(300,30*2**notification.attempts)]);
    } else {
      await this.database.query(`UPDATE app.operation_notifications SET delivery_state=$2,updated_at=now() WHERE id=$1 AND delivery_state='sending'`, [notification.id,result.state === 'retry' ? 'failed' : result.state]);
    }
    return true;
  }
}
