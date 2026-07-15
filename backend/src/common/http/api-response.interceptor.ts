import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

import type { RequestContext } from './request-context';

export interface ApiSuccessResponse<T> {
  data: T;
  message: 'ok';
  requestId: string;
  success: true;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    return next.handle().pipe(
      map((data) => ({
        data,
        message: 'ok',
        requestId: request.requestId ?? 'unknown',
        success: true as const,
      })),
    );
  }
}
