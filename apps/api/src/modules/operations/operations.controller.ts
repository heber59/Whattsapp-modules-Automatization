import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { OperationsService } from './operations.service';

@Controller('businesses/:businessId/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  snapshot(@CurrentUser() user: Principal, @Param('businessId', new ParseUUIDPipe({ version: '4' })) business: string) {
    return this.operations.snapshot(user, business);
  }
  @Get('conversations/:sender')
  @Header('Cache-Control', 'no-store')
  history(@CurrentUser() user: Principal, @Param('businessId', new ParseUUIDPipe({ version: '4' })) business: string, @Param('sender') sender: string) {
    return this.operations.history(user, business, sender);
  }
  @Post('actions')
  @Header('Cache-Control', 'no-store')
  action(@CurrentUser() user: Principal, @Param('businessId', new ParseUUIDPipe({ version: '4' })) business: string, @Body() input: unknown) {
    return this.operations.action(user, business, input);
  }
}
