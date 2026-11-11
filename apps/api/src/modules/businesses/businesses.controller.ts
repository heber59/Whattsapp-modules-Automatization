import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { BusinessesService } from './businesses.service';

const businessSchema = {
  type: 'object' as const, required: ['id', 'name', 'role'],
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    name: { type: 'string' as const },
    role: { type: 'string' as const, enum: ['owner', 'admin', 'operator'] },
  },
};

@ApiTags('Businesses')
@ApiBearerAuth('supabase')
@ApiUnauthorizedResponse({ description: 'A valid Supabase session is required.' })
@ApiTooManyRequestsResponse({ description: 'IP or user limit reached; check Retry-After.' })
@ApiServiceUnavailableResponse({ description: 'Authentication is not configured or a dependency is unavailable.' })
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a business', description: 'Also creates the authenticated user as an owner member in the same transaction.' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object', required: ['name'], additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1, maxLength: 100, example: 'My store' } },
    },
  })
  @ApiCreatedResponse({ description: 'Business and membership created.', schema: businessSchema })
  @ApiBadRequestResponse({ description: 'Empty or invalid name, or unsupported additional fields.' })
  create(@CurrentUser() user: Principal, @Body() input: unknown) {
    return this.businesses.create(user, input);
  }

  @Get()
  @ApiOperation({ summary: 'List my businesses', description: 'Returns only businesses where the current user has a membership.' })
  @ApiOkResponse({ schema: { type: 'array', items: businessSchema } })
  list(@CurrentUser() user: Principal) {
    return this.businesses.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my businesses' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Business UUID v4.' })
  @ApiOkResponse({ schema: businessSchema })
  @ApiBadRequestResponse({ description: 'The ID is not a valid UUID v4.' })
  @ApiNotFoundResponse({ description: 'The business does not exist or the current user has no membership.' })
  find(@CurrentUser() user: Principal, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.businesses.find(user, id);
  }
}
