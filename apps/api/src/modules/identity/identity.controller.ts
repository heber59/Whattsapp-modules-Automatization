import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { IdentityService } from './identity.service';

@ApiTags('Identidad')
@ApiBearerAuth('supabase')
@ApiUnauthorizedResponse({ description: 'Sesión ausente, inválida o anónima.' })
@ApiTooManyRequestsResponse({ description: 'Límite por IP o usuario alcanzado; consultar Retry-After.' })
@ApiServiceUnavailableResponse({ description: 'Autenticación sin configurar o dependencia no disponible.' })
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consultar y sincronizar mi perfil', description: 'La identidad se obtiene de Supabase, no de parámetros enviados por el cliente.' })
  @ApiOkResponse({
    schema: {
      type: 'object', required: ['id', 'auth_user_id', 'email'],
      properties: {
        id: { type: 'string', format: 'uuid', description: 'ID interno de la aplicación.' },
        auth_user_id: { type: 'string', format: 'uuid', description: 'ID de Supabase Auth.' },
        email: { type: 'string', format: 'email', nullable: true },
      },
    },
  })
  me(@CurrentUser() user: Principal) {
    return this.identity.sync(user);
  }
}
