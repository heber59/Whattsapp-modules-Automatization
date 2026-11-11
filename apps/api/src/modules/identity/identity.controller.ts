import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { IdentityService } from './identity.service';

@ApiTags('Identity')
@ApiBearerAuth('supabase')
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or anonymous session.' })
@ApiTooManyRequestsResponse({ description: 'IP or user limit reached; check Retry-After.' })
@ApiServiceUnavailableResponse({ description: 'Authentication is not configured or a dependency is unavailable.' })
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get and synchronize my profile', description: 'Identity comes from Supabase, not from client-supplied parameters.' })
  @ApiOkResponse({
    schema: {
      type: 'object', required: ['id', 'auth_user_id', 'email'],
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Internal application ID.' },
        auth_user_id: { type: 'string', format: 'uuid', description: 'Supabase Auth ID.' },
        email: { type: 'string', format: 'email', nullable: true },
      },
    },
  })
  me(@CurrentUser() user: Principal) {
    return this.identity.sync(user);
  }
}
