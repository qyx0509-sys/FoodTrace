import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import type { RequestContext } from '../http/request-context';

interface RateWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class SensitiveRouteRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, RateWindow>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const now = Date.now();
    const route = `${request.method}:${request.path}`;
    const key = `${request.ip}:${route}`;
    const current = this.windows.get(key);
    if (current === undefined || current.resetAt <= now) {
      if (this.windows.size > 10_000) {
        for (const [windowKey, window] of this.windows) {
          if (window.resetAt <= now) this.windows.delete(windowKey);
        }
      }
      this.windows.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    current.count += 1;
    if (current.count > 10) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
