import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RateLimitService } from '../../shared/auth/rate-limit.service';
import type { Principal } from '../../shared/auth/auth.types';
import { CommercialRepository } from './commercial.repository';
import { contactInput, purchaseInput } from './commercial.rules';

@Injectable()
export class CommercialService {
  constructor(private readonly repository: CommercialRepository, private readonly limiter: RateLimitService) {}

  async submit(input: unknown, user?: Principal) {
    const parsed = (user ? purchaseInput : contactInput).safeParse(input);
    if (!parsed.success) throw new BadRequestException('Provide consent and a valid email or international phone number');
    const value = parsed.data;
    const retry = await this.limiter.consume('account', 'commercial:' + (user?.subject ?? value.email ?? value.phone));
    if (retry) throw new HttpException({ message: 'Too many requests; try again later', retryAfter: retry }, HttpStatus.TOO_MANY_REQUESTS);
    const plan = 'plan' in value ? String(value.plan) : null;
    await this.repository.create(value, user?.subject ?? null, plan);
    return { status: plan ? 'pending_contact' : 'received' };
  }
}
