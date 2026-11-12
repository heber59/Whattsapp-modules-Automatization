import { NotificationSenderService } from './notification-sender.service';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { FlowsModule } from '../flows/flows.module';
import { WhatsAppRuntimeService } from './whatsapp-runtime.service';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { WhatsAppWorkerService } from './whatsapp-worker.service';
import { MetaGateway } from './meta.gateway';

@Module({ imports: [DatabaseModule,FlowsModule], providers: [NotificationSenderService,WhatsAppRuntimeService,WhatsAppSenderService,WhatsAppWorkerService,MetaGateway], exports: [WhatsAppWorkerService] })
export class WhatsAppWorkerModule {}
