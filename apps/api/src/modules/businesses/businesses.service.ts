import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { Principal } from '../../shared/auth/auth.types';
import { IdentityService } from '../identity/identity.service';
import { BusinessesRepository } from './businesses.repository';

const createBusiness = z.object({ name: z.string().trim().min(1).max(100) }).strict();

@Injectable()
export class BusinessesService {
  constructor(private readonly identity: IdentityService, private readonly repository: BusinessesRepository) {}

  async create(user: Principal, input: unknown) {
    const parsed = createBusiness.safeParse(input);
    if (!parsed.success) throw new BadRequestException('A valid name is required; permissions and owners are not accepted in the request body');
    const identity = await this.identity.sync(user);
    return this.repository.create(identity.id, parsed.data.name);
  }

  async list(user: Principal) {
    const identity = await this.identity.sync(user);
    return this.repository.list(identity.id);
  }

  async find(user: Principal, businessId: string) {
    const identity = await this.identity.sync(user);
    const business = await this.repository.find(identity.id, businessId);
    if (!business) throw new NotFoundException('Business not available');
    return business;
  }
}
