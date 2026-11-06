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

@ApiTags('Negocios')
@ApiBearerAuth('supabase')
@ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida de Supabase.' })
@ApiTooManyRequestsResponse({ description: 'Límite por IP o usuario alcanzado; consultar Retry-After.' })
@ApiServiceUnavailableResponse({ description: 'Autenticación sin configurar o dependencia no disponible.' })
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un negocio', description: 'Crea también la membresía owner del usuario autenticado, en una transacción.' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object', required: ['name'], additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1, maxLength: 100, example: 'Mi comercio' } },
    },
  })
  @ApiCreatedResponse({ description: 'Negocio y membresía creados.', schema: businessSchema })
  @ApiBadRequestResponse({ description: 'Nombre vacío o inválido, o campos adicionales no permitidos.' })
  create(@CurrentUser() user: Principal, @Body() input: unknown) {
    return this.businesses.create(user, input);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis negocios', description: 'Devuelve únicamente negocios donde el usuario tiene membresía.' })
  @ApiOkResponse({ schema: { type: 'array', items: businessSchema } })
  list(@CurrentUser() user: Principal) {
    return this.businesses.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar uno de mis negocios' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID v4 del negocio.' })
  @ApiOkResponse({ schema: businessSchema })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID v4 válido.' })
  @ApiNotFoundResponse({ description: 'El negocio no existe o el usuario no tiene membresía.' })
  find(@CurrentUser() user: Principal, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.businesses.find(user, id);
  }
}
