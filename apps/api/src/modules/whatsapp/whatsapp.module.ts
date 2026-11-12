import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { FlowsModule } from '../flows/flows.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppService } from './whatsapp.service';

@Module({ imports: [DatabaseModule,BusinessesModule,FlowsModule], controllers: [WhatsAppController,WhatsAppWebhookController], providers: [WhatsAppRepository,WhatsAppService] })
export class WhatsAppModule {}
