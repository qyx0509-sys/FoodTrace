import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { WeChatAuthClient } from './wechat-auth.client';

describe('AuthService refresh rotation', () => {
  it('revokes the whole token family when a revoked refresh token is replayed', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      refreshSession: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() + 60_000), familyId: 'family-a', id: '00000000-0000-4000-8000-000000000001',
          revokedAt: new Date(), tokenHash: '', user: { deletedAt: null, status: 'ACTIVE' },
        }),
        updateMany,
      },
    } as unknown as PrismaService;
    const config = new ConfigService({
      JWT_ACCESS_SECRET: 'unit-access-secret-at-least-32-characters', JWT_ACCESS_TTL_SECONDS: 900,
      JWT_AUDIENCE: 'foodtrace-client', JWT_ISSUER: 'foodtrace-api',
      JWT_REFRESH_SECRET: 'unit-refresh-secret-at-least-32-characters', JWT_REFRESH_TTL_SECONDS: 2_592_000,
    });
    const tokens = new JwtTokenService(config);
    const replayedToken = '00000000-0000-4000-8000-000000000001.replayed-secret';
    const session = await (prisma.refreshSession as unknown as { findUnique(): Promise<{ tokenHash: string }> }).findUnique();
    session.tokenHash = tokens.hashRefreshToken(replayedToken);
    const service = new AuthService(prisma, tokens, {} as unknown as WeChatAuthClient, config);

    await expect(service.refresh({ refreshToken: replayedToken })).rejects.toThrow('刷新凭证无效');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { familyId: 'family-a' } }));
  });
});
