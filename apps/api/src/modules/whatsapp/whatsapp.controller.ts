import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller('businesses/:businessId/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}
  @Get()
  @Header('Cache-Control','no-store')
  describe(@CurrentUser() user: Principal, @Param('businessId') business: string) { return this.whatsapp.describe(user,business); }
  @Post()
  @Header('Cache-Control','no-store')
  configure(@CurrentUser() user: Principal, @Param('businessId') business: string, @Body() input: unknown) { return this.whatsapp.configure(user,business,input); }
}
