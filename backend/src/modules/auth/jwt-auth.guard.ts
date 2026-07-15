import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import type { RequestContext } from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: JwtTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const authorization = request.headers.authorization;
    if (authorization === undefined || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '请先登录' });
    }

    const claims = this.tokens.verifyAccessToken(authorization.slice('Bearer '.length).trim());
    const session = await this.prisma.refreshSession.findFirst({
      select: { id: true, userId: true },
      where: {
        expiresAt: { gt: new Date() },
        id: claims.sid,
        revokedAt: null,
        user: {
          deletedAt: null,
          id: claims.sub,
          status: 'ACTIVE',
          tokenVersion: claims.ver,
        },
      },
    });
    if (session === null) {
      throw new UnauthorizedException({ code: 'AUTH_REVOKED', message: '登录状态已失效' });
    }
    request.auth = { sessionId: session.id, userId: session.userId };
    return true;
  }
}
