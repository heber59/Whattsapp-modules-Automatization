import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Public } from '../shared/auth/auth.decorators';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check PostgreSQL and Redis', security: [] })
  @ApiOkResponse({
    description: 'Both dependencies are responding.',
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
  @ApiServiceUnavailableResponse({ description: 'A dependency is unavailable or access control failed.' })
  @ApiTooManyRequestsResponse({ description: 'IP limit reached. Retry according to Retry-After.' })
  async check() {
    const result = await this.health.check();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
