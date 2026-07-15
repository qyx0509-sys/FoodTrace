import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { RequestContext } from '../../common/http/request-context';
import type { AuthenticatedUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestContext>();
    if (request.auth === undefined) {
      throw new Error('CurrentUser used without JwtAuthGuard');
    }
    return request.auth;
  },
);
