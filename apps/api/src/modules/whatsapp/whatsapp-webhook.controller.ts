import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Headers, HttpCode, Post, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../../shared/auth/auth.decorators';
import { WhatsAppRepository } from './whatsapp.repository';

const timestamp = z.string().regex(/^[0-9]{1,12}$/).transform(Number).refine((value) => value > 0 && value < 8640000000000);
const payload = z.object({ object: z.literal('whatsapp_business_account'), entry: z.array(z.object({
  changes: z.array(z.object({ field: z.string(), value: z.object({
    metadata: z.object({ phone_number_id: z.string() }).optional(),
    messages: z.array(z.object({ id: z.string().min(1).max(255), from: z.string().regex(/^[1-9][0-9]{6,14}$/), timestamp,
      type: z.string(), text: z.object({ body: z.string().max(4096) }).optional() })).max(100).optional(),
    statuses: z.array(z.object({ id: z.string().min(1).max(255), status: z.string().max(100), timestamp })).max(100).optional(),
  }) })).max(100),
})).max(100) });

@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly repository: WhatsAppRepository, private readonly config: ConfigService) {}

  @Get()
  @Header('Content-Type','text/plain')
  @Header('Cache-Control','no-store')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const expected = this.config.get<string>('META_VERIFY_TOKEN');
    if (!expected) throw new ServiceUnavailableException('WhatsApp verification is not configured');
    const hash = (value: string) => createHmac('sha256', expected).update(value).digest();
    if (mode !== 'subscribe' || typeof token !== 'string' || !timingSafeEqual(hash(token), hash(expected)) || typeof challenge !== 'string' || !/^[0-9]{1,100}$/.test(challenge)) throw new ForbiddenException('Invalid webhook verification');
    return challenge;
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control','no-store')
  async receive(@Headers('x-hub-signature-256') signature: string | undefined, @Req() request: { rawBody?: Buffer }, @Body() body: unknown) {
    const secret = this.config.get<string>('META_APP_SECRET');
    if (!secret) throw new ServiceUnavailableException('WhatsApp signatures are not configured');
    if (!request.rawBody || !signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) throw new ForbiddenException('Invalid webhook signature');
    const digest = createHmac('sha256', secret).update(request.rawBody).digest();
    if (!timingSafeEqual(digest, Buffer.from(signature.slice(7),'hex'))) throw new ForbiddenException('Invalid webhook signature');
    const parsed = payload.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid WhatsApp webhook payload');
    const phone = this.config.get<string>('META_PHONE_NUMBER_ID');
    const business = this.config.get<string>('META_BUSINESS_ID');
    if (!phone || !business) return { received: true };
    for (const entry of parsed.data.entry) for (const change of entry.changes) {
      if (change.field !== 'messages' || change.value.metadata?.phone_number_id !== phone) continue;
      const messages = (change.value.messages ?? []).map((item) => ({ id: item.id, sender: item.from,
        text: item.type === 'text' ? item.text?.body ?? null : null, sentAt: new Date(item.timestamp * 1000) }));
      const statuses = (change.value.statuses ?? []).filter((item) => ['sent','delivered','read','failed'].includes(item.status))
        .map((item) => ({ id: item.id, status: item.status, at: new Date(item.timestamp * 1000) }));
      await this.repository.ingest(phone,business,messages,statuses);
    }
    return { received: true };
  }
}
