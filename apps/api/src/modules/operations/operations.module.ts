import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({ imports: [DatabaseModule, BusinessesModule], controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
