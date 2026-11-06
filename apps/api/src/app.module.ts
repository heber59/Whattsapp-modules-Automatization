import { Module } from '@nestjs/common';
import { EnvironmentModule } from './shared/config/environment.module';
import { DatabaseModule } from './shared/database/database.module';
import { QueueModule } from './shared/queue/queue.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

@Module({
  imports: [EnvironmentModule, DatabaseModule, QueueModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
