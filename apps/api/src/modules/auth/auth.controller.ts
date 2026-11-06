import { Body, Controller, Header, HttpCode, HttpException, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../../shared/auth/auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({
    summary: 'Iniciar sesión con correo y contraseña',
    description: 'Usa el usuario creado en Supabase Auth. Devuelve un access_token para probar las rutas privadas. No recibe claves de proyecto.',
    security: [],
  })
  @ApiBody({
    required: true,
    schema: {
      type: 'object', required: ['email', 'password'], additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', format: 'password', minLength: 1, maxLength: 1024, writeOnly: true },
        captchaToken: { type: 'string', description: 'Obligatorio si Supabase exige CAPTCHA.', maxLength: 4096, writeOnly: true },
      },
    },
  })
  @ApiOkResponse({
    description: 'Sesión iniciada. Copia access_token en Authorize o en Bearer Token de Postman.',
    schema: {
      type: 'object', required: ['access_token', 'token_type', 'expires_in'],
      properties: {
        access_token: { type: 'string' }, token_type: { type: 'string', example: 'bearer' },
        expires_in: { type: 'integer', description: 'Vigencia en segundos.' },
        expires_at: { type: 'integer', description: 'Expiración como timestamp Unix.' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Cuerpo inválido o campos adicionales.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales incorrectas o acceso no permitido por Supabase; mensaje genérico.' })
  @ApiTooManyRequestsResponse({ description: 'Límite por IP o cuenta alcanzado; consultar Retry-After.' })
  @ApiServiceUnavailableResponse({ description: 'Supabase o control de acceso no disponible.' })
  async login(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const result = await this.auth.login(input);
    if (result.status === 'limited') {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException('Demasiadas solicitudes; inténtalo más tarde', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result.session;
  }
}
