import { Module } from '@nestjs/common';
import { WhatsAppWorkerModule } from './modules/whatsapp/whatsapp-worker.module';
import { EnvironmentModule } from './shared/config/environment.module';
import { SystemWorkerService } from './system-worker.service';

@Module({ imports: [EnvironmentModule, WhatsAppWorkerModule], providers: [SystemWorkerService] })
export class WorkerModule {}
