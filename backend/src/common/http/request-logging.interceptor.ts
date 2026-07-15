import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

import type { RequestContext } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const write = (statusCode: number): void => {
      this.logger.log(
        JSON.stringify({
          durationMs: Date.now() - startedAt,
          method: request.method,
          path: request.path,
          requestId: request.requestId ?? 'unknown',
          statusCode,
        }),
      );
    };
    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          write(error instanceof HttpException ? error.getStatus() : 500);
        },
        next: () => write(response.statusCode),
      }),
    );
  }
}
