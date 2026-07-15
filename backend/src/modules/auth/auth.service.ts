import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service';
import type { User } from '../../generated/prisma/client';
import type { AuthenticatedUser, WeChatIdentity } from './auth.types';
import type { RefreshTokenDto, WeChatMiniLoginDto } from './dto/auth.dto';
import { JwtTokenService } from './jwt-token.service';
import { WeChatAuthClient } from './wechat-auth.client';

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: {
    avatarObjectKey: string | null;
    id: string;
    nickname: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: JwtTokenService,
    private readonly wechat: WeChatAuthClient,
    private readonly config: ConfigService,
  ) {}

  async loginWithMiniProgram(dto: WeChatMiniLoginDto): Promise<SessionResponse> {
    const identity = await this.wechat.exchangeMiniCode(dto.code);
    const user = await this.resolveMiniProgramUser(identity);
    return this.createSession(user, dto.deviceId, dto.deviceName);
  }

  async refresh(dto: RefreshTokenDto): Promise<SessionResponse> {
    const sessionId = dto.refreshToken.split('.', 1)[0];
    if (sessionId === undefined || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw this.invalidRefreshToken();
    }
    const tokenHash = this.tokens.hashRefreshToken(dto.refreshToken);
    const current = await this.prisma.refreshSession.findUnique({
      include: { user: true },
      where: { id: sessionId },
    });
    if (current === null || !this.tokens.safeEqual(current.tokenHash, tokenHash)) {
      throw this.invalidRefreshToken();
    }
    const now = new Date();
    if (
      current.revokedAt !== null ||
      current.expiresAt <= now ||
      current.user.status !== 'ACTIVE' ||
      current.user.deletedAt !== null
    ) {
      if (current.revokedAt !== null) {
        await this.prisma.refreshSession.updateMany({
          data: { reuseDetectedAt: now, revokedAt: now },
          where: { familyId: current.familyId },
        });
      }
      throw this.invalidRefreshToken();
    }

    const replacementId = randomUUID();
    const replacementSecret = this.tokens.createRefreshSecret();
    const replacementToken = `${replacementId}.${replacementSecret}`;
    const replacementHash = this.tokens.hashRefreshToken(replacementToken);
    const expiresAt = new Date(now.getTime() + this.tokens.refreshTtlSeconds * 1000);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        data: { lastUsedAt: now, replacedById: replacementId, revokedAt: now },
        where: { id: current.id, revokedAt: null, tokenHash },
      });
      if (revoked.count !== 1) {
        return null;
      }
      return transaction.refreshSession.create({
        data: {
          deviceId: current.deviceId,
          deviceName: current.deviceName,
          expiresAt,
          familyId: current.familyId,
          id: replacementId,
          tokenHash: replacementHash,
          userId: current.userId,
        },
      });
    });
    if (rotated === null) {
      await this.prisma.refreshSession.updateMany({
        data: { reuseDetectedAt: now, revokedAt: now },
        where: { familyId: current.familyId },
      });
      throw this.invalidRefreshToken();
    }
    return this.formatSession(current.user, rotated.id, replacementToken);
  }

  async logout(auth: AuthenticatedUser): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      data: { revokedAt: new Date() },
      where: { id: auth.sessionId, userId: auth.userId },
    });
  }

  private async resolveMiniProgramUser(identity: WeChatIdentity): Promise<User> {
    const appId = this.config.getOrThrow<string>('WECHAT_MINI_APP_ID');
    const existing = await this.prisma.authIdentity.findUnique({
      include: { user: true },
      where: {
        provider_appId_providerUserId: {
          appId,
          provider: 'WECHAT_MINI',
          providerUserId: identity.openId,
        },
      },
    });
    if (existing !== null) {
      if (existing.user.status !== 'ACTIVE' || existing.user.deletedAt !== null) {
        throw new UnauthorizedException({ code: 'USER_DISABLED', message: '账号当前不可用' });
      }
      await this.prisma.user.update({
        data: { lastLoginAt: new Date() },
        where: { id: existing.userId },
      });
      return existing.user;
    }

    const linkedIdentity =
      identity.unionId === null
        ? null
        : await this.prisma.authIdentity.findFirst({
            select: { userId: true },
            where: { unionId: identity.unionId, user: { deletedAt: null, status: 'ACTIVE' } },
          });
    return this.prisma.$transaction(async (transaction) => {
      const user =
        linkedIdentity === null
          ? await transaction.user.create({ data: { lastLoginAt: new Date() } })
          : await transaction.user.update({
              data: { lastLoginAt: new Date() },
              where: { id: linkedIdentity.userId },
            });
      await transaction.authIdentity.create({
        data: {
          appId,
          provider: 'WECHAT_MINI',
          providerUserId: identity.openId,
          unionId: identity.unionId,
          userId: user.id,
        },
      });
      return user;
    });
  }

  private async createSession(
    user: {
      avatarObjectKey: string | null;
      id: string;
      nickname: string | null;
      tokenVersion: number;
    },
    deviceId: string,
    deviceName: string,
  ): Promise<SessionResponse> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshToken = `${sessionId}.${this.tokens.createRefreshSecret()}`;
    await this.prisma.refreshSession.create({
      data: {
        deviceId,
        deviceName,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlSeconds * 1000),
        familyId,
        id: sessionId,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        userId: user.id,
      },
    });
    return this.formatSession(user, sessionId, refreshToken);
  }

  private formatSession(
    user: {
      avatarObjectKey: string | null;
      id: string;
      nickname: string | null;
      tokenVersion: number;
    },
    sessionId: string,
    refreshToken: string,
  ): SessionResponse {
    return {
      accessToken: this.tokens.signAccessToken(user.id, sessionId, user.tokenVersion),
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      refreshToken,
      user: {
        avatarObjectKey: user.avatarObjectKey,
        id: user.id,
        nickname: user.nickname,
      },
    };
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({ code: 'REFRESH_INVALID', message: '刷新凭证无效或已失效' });
  }
}
