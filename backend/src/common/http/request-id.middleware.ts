import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';

import type { RequestContext } from './request-context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestContext, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
