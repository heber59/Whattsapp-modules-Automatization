import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { DatabaseModule } from '../../shared/database/database.module';
import { FlowsController } from './flows.controller';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';

@Module({ imports: [BusinessesModule, DatabaseModule], controllers: [FlowsController], providers: [FlowsRepository, FlowsService], exports: [FlowsService] })
export class FlowsModule {}
