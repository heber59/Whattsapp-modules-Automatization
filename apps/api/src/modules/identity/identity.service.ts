import { Injectable } from '@nestjs/common';
import type { Principal } from '../../shared/auth/auth.types';
import { IdentityRepository } from './identity.repository';

@Injectable()
export class IdentityService {
  constructor(private readonly repository: IdentityRepository) {}

  sync(user: Principal) {
    return this.repository.sync(user);
  }
}
