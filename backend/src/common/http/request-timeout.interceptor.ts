import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs';

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(15_000),
      catchError((error: unknown) =>
        error instanceof TimeoutError
          ? throwError(() => new RequestTimeoutException('请求处理超时'))
          : throwError(() => error),
      ),
    );
  }
}
