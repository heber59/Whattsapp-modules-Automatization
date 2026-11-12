import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { DatabaseModule } from '../../shared/database/database.module';
import { FlowsController } from './flows.controller';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { FlowToolsService } from './flow-tools.service';
import { FlowMcpController } from './flow-mcp.controller';

@Module({ imports: [BusinessesModule, DatabaseModule], controllers: [FlowsController, FlowMcpController], providers: [FlowsRepository, FlowsService, FlowToolsService], exports: [FlowsService] })
export class FlowsModule {}
