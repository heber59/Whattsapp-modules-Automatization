import { Body, Controller, Header, HttpCode, HttpException, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../../shared/auth/auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({
    summary: 'Sign in with email and password',
    description: 'Use an existing Supabase Auth user. Returns an access_token for private routes. Project keys are not accepted.',
    security: [],
  })
  @ApiBody({
    required: true,
    schema: {
      type: 'object', required: ['email', 'password'], additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', format: 'password', minLength: 1, maxLength: 1024, writeOnly: true },
        captchaToken: { type: 'string', description: 'Required when Supabase requires CAPTCHA.', maxLength: 4096, writeOnly: true },
      },
    },
  })
  @ApiOkResponse({
    description: 'Signed in. Use access_token in Authorize or as a Bearer token in an HTTP client.',
    schema: {
      type: 'object', required: ['access_token', 'token_type', 'expires_in'],
      properties: {
        access_token: { type: 'string' }, token_type: { type: 'string', example: 'bearer' },
        expires_in: { type: 'integer', description: 'Validity in seconds.' },
        expires_at: { type: 'integer', description: 'Expiration as a Unix timestamp.' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request body or additional fields.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or access denied by Supabase; generic response.' })
  @ApiTooManyRequestsResponse({ description: 'IP or account limit reached; check Retry-After.' })
  @ApiServiceUnavailableResponse({ description: 'Supabase or access control is unavailable.' })
  async login(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const result = await this.auth.login(input);
    if (result.status === 'limited') {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException('Too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result.session;
  }
}
