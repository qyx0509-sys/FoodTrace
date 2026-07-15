import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { JwtTokenService } from './jwt-token.service';

function createService(): JwtTokenService {
  return new JwtTokenService(
    new ConfigService({
      JWT_ACCESS_SECRET: 'unit-access-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_AUDIENCE: 'foodtrace-client',
      JWT_ISSUER: 'foodtrace-api',
      JWT_REFRESH_SECRET: 'unit-refresh-secret-at-least-32-characters',
      JWT_REFRESH_TTL_SECONDS: 2_592_000,
    }),
  );
}

describe('JwtTokenService', () => {
  it('signs and verifies a scoped access token', () => {
    const service = createService();
    const token = service.signAccessToken('user-a', 'session-a', 2);

    expect(service.verifyAccessToken(token)).toMatchObject({
      aud: 'foodtrace-client',
      iss: 'foodtrace-api',
      sid: 'session-a',
      sub: 'user-a',
      ver: 2,
    });
  });

  it('rejects a token whose payload was modified', () => {
    const service = createService();
    const token = service.signAccessToken('user-a', 'session-a', 0);
    const [header, payload, signature] = token.split('.');
    const changedPayload = `${payload?.slice(0, -1)}A`;

    expect(() => service.verifyAccessToken(`${header}.${changedPayload}.${signature}`)).toThrow(
      '登录状态无效',
    );
  });
});
