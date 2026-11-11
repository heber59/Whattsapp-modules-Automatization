import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE } from './auth.decorators';
import type { AccessRequest } from './auth.types';
import { RateLimitService } from './rate-limit.service';
import { SupabaseAuthGateway } from './supabase-auth.gateway';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
    private readonly gateway: SupabaseAuthGateway,
  ) {}

  private reject(context: ExecutionContext, retry: number): never {
    context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>()
      .setHeader('Retry-After', String(retry));
    throw new HttpException('Too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    const retry = await this.limiter.consume('ip', request.ip ?? request.socket.remoteAddress ?? 'unknown');
    if (retry) this.reject(context, retry);
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header) : null;
    if (!match?.[1] || match[1].length > 8192) throw new UnauthorizedException('Invalid session');
    request.user = await this.gateway.verify(match[1]);
    const userRetry = await this.limiter.consume('user', request.user.subject);
    if (userRetry) this.reject(context, userRetry);
    return true;
  }
}
