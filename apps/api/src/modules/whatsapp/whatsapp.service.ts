import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Principal } from '../../shared/auth/auth.types';
import { BusinessesService } from '../businesses/businesses.service';
import { FlowsService } from '../flows/flows.service';
import { WhatsAppRepository } from './whatsapp.repository';
import { missingMeta } from './whatsapp.settings';

@Injectable()
export class WhatsAppService {
  constructor(private readonly businesses: BusinessesService, private readonly flows: FlowsService,
    private readonly repository: WhatsAppRepository, private readonly config: ConfigService) {}

  private async access(user: Principal, business: string) {
    if (!z.uuid().safeParse(business).success) throw new BadRequestException('Invalid business identifier');
    return this.businesses.find(user, business);
  }

  async describe(user: Principal, business: string) {
    await this.access(user, business);
    const missing = missingMeta(this.config);
    const allowed = this.config.get<string>('META_BUSINESS_ID') === business;
    const channel = allowed ? await this.repository.channel(business) : null;
    return { channel: channel ? { phoneNumberId: channel.phoneNumberId, flowId: channel.flowId, version: channel.version, status: 'configured' } : null,
      configuration: { ready: missing.length === 0 && allowed, missing, pilotAllowed: allowed }, webhookPath: '/webhooks/whatsapp' };
  }

  async configure(user: Principal, business: string, input: unknown) {
    const membership = await this.access(user, business);
    if (membership.role === 'operator') throw new ForbiddenException('Only business owners and admins can configure WhatsApp');
    if (missingMeta(this.config).length) throw new ServiceUnavailableException('WhatsApp server configuration is pending');
    if (this.config.get<string>('META_BUSINESS_ID') !== business) throw new ForbiddenException('This business is not enabled for the pilot phone');
    const parsed = z.object({ flowId: z.uuid(), version: z.number().int().positive().max(2147483647) }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException('Choose a published flow and version');
    await this.flows.version(user, business, parsed.data.flowId, String(parsed.data.version));
    await this.repository.configure(business, this.config.getOrThrow<string>('META_PHONE_NUMBER_ID'), parsed.data.flowId, parsed.data.version);
    return this.describe(user, business);
  }
}
