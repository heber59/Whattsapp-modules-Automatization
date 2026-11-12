import { Body, Controller, Header, Headers, HttpCode, HttpException, HttpStatus, Post, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Public } from '../../shared/auth/auth.decorators';
import { AuthService } from './auth.service';

type ResponseHeaders = { setHeader(name: string, value: string): void };

@Public()
@ApiExcludeController()
@Controller('auth/web')
export class WebAuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  private authorize(key: string | undefined): void {
    const expected = this.config.get<string>('WEB_AUTH_SECRET');
    if (!expected) throw new ServiceUnavailableException('Web authentication configuration is pending');
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!key || !timingSafeEqual(digest(key), digest(expected))) throw new UnauthorizedException('Invalid web authentication client');
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async login(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown,
    @Res({ passthrough: true }) response: ResponseHeaders) {
    this.authorize(key);
    const result = await this.auth.login(input, true);
    if (result.status === 'limited') {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException('Too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result.session;
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  refresh(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown) {
    this.authorize(key);
    return this.auth.refresh(input);
  }

  @Post('signup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async signup(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown,
    @Res({ passthrough: true }) response: ResponseHeaders) {
    this.authorize(key);
    const result = await this.auth.signup(input);
    if (result.status === 'limited') {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException('Too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result;
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  logout(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown) {
    this.authorize(key);
    return this.auth.logout(input);
  }

  @Post('recover/request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async requestRecovery(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown,
    @Res({ passthrough: true }) response: ResponseHeaders) {
    this.authorize(key);
    const result = await this.auth.requestRecovery(input);
    if (result.status === 'limited') {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException('Too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result;
  }

  @Post('recover/complete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  completeRecovery(@Headers('x-web-auth-key') key: string | undefined, @Body() input: unknown) {
    this.authorize(key);
    return this.auth.completeRecovery(input);
  }
}
