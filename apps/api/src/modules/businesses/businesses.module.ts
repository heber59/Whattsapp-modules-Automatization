import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [DatabaseModule, IdentityModule], controllers: [BusinessesController],
  providers: [BusinessesRepository, BusinessesService],
})
export class BusinessesModule {}
