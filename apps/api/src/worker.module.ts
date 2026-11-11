import { Module } from '@nestjs/common';
import { EnvironmentModule } from './shared/config/environment.module';
import { SystemWorkerService } from './system-worker.service';

@Module({ imports: [EnvironmentModule], providers: [SystemWorkerService] })
export class WorkerModule {}
