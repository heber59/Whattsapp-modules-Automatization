import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AccessRequest } from './auth.types';

export const PUBLIC_ROUTE = 'wa:public';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AccessRequest>().user,
);
