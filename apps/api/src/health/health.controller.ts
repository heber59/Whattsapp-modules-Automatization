import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Public } from '../shared/auth/auth.decorators';
import { HealthService } from './health.service';

@ApiTags('Estado')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Comprobar PostgreSQL y Redis', security: [] })
  @ApiOkResponse({
    description: 'Ambas dependencias responden.',
    schema: {
      type: 'object', required: ['status', 'services'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        services: {
          type: 'object', required: ['database', 'queue'],
          properties: { database: { type: 'string', enum: ['ok'] }, queue: { type: 'string', enum: ['ok'] } },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'Una dependencia no responde o falla el control de acceso.' })
  @ApiTooManyRequestsResponse({ description: 'Límite por IP alcanzado. Reintentar según Retry-After.' })
  async check() {
    const result = await this.health.check();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
