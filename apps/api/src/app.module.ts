import { AuthModule } from './modules/auth/auth.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { Module } from '@nestjs/common';
import { EnvironmentModule } from './shared/config/environment.module';
import { DatabaseModule } from './shared/database/database.module';
import { QueueModule } from './shared/queue/queue.module';
import { AccessModule } from './shared/auth/access.module';
import { IdentityModule } from './modules/identity/identity.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

@Module({
  imports: [EnvironmentModule, DatabaseModule, QueueModule, AccessModule, AuthModule, IdentityModule, BusinessesModule, CommercialModule],
  controllers: [HealthController], providers: [HealthService],
})
export class AppModule {}
