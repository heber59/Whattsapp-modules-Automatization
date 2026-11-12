import { Body, Controller, Get, Header, HttpException, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { CommercialService } from './commercial.service';

@ApiTags('Commercial')
@Controller('commercial')
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Public()
  @Get('plans')
  plans() {
    return { plans: [{ id: 'full-access', name: 'Full access', price: 50000, currency: 'COP', interval: 'month' }], checkoutAvailable: false };
  }

  @Public()
  @Post('leads')
  @Header('Cache-Control', 'no-store')
  lead(@Body() input: unknown, @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    return this.submit(input, response);
  }

  @Post('purchase-requests')
  @Header('Cache-Control', 'no-store')
  purchase(@Body() input: unknown, @CurrentUser() user: Principal,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    return this.submit(input, response, user);
  }

  private async submit(input: unknown, response: { setHeader(name: string, value: string): void }, user?: Principal) {
    try { return await this.commercial.submit(input, user); }
    catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        const body = error.getResponse() as { retryAfter?: number };
        if (body.retryAfter) response.setHeader('Retry-After', String(body.retryAfter));
      }
      throw error;
    }
  }
}
