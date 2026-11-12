import { Body, Controller, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { FlowsService } from './flows.service';

@ApiTags('Flows')
@Controller('businesses/:businessId/flows')
export class FlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Header('Cache-Control', 'no-store')
  @Get()
  list(@CurrentUser() user: Principal, @Param('businessId') business: string) { return this.flows.list(user, business); }

  @Header('Cache-Control', 'no-store')
  @Post()
  create(@CurrentUser() user: Principal, @Param('businessId') business: string, @Body() input: unknown) { return this.flows.create(user, business, input); }

  @Header('Cache-Control', 'no-store')
  @Get(':flowId')
  find(@CurrentUser() user: Principal, @Param('businessId') business: string, @Param('flowId') flow: string) { return this.flows.find(user, business, flow); }

  @Header('Cache-Control', 'no-store')
  @Patch(':flowId')
  save(@CurrentUser() user: Principal, @Param('businessId') business: string, @Param('flowId') flow: string, @Body() input: unknown) { return this.flows.save(user, business, flow, input); }

  @Header('Cache-Control', 'no-store')
  @Post(':flowId/publish')
  publish(@CurrentUser() user: Principal, @Param('businessId') business: string, @Param('flowId') flow: string, @Body() input: unknown) { return this.flows.publish(user, business, flow, input); }

  @Header('Cache-Control', 'no-store')
  @Get(':flowId/versions/:version')
  version(@CurrentUser() user: Principal, @Param('businessId') business: string, @Param('flowId') flow: string, @Param('version') version: string) { return this.flows.version(user, business, flow, version); }
}
