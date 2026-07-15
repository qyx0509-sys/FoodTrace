import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AccessTokenClaims } from './auth.types';

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(config: ConfigService) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.audience = config.getOrThrow<string>('JWT_AUDIENCE');
    this.issuer = config.getOrThrow<string>('JWT_ISSUER');
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    this.refreshTtlSeconds = config.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS');
  }

  signAccessToken(userId: string, sessionId: string, tokenVersion: number): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const payload = encodeJson({
      aud: this.audience,
      exp: issuedAt + this.accessTtlSeconds,
      iat: issuedAt,
      iss: this.issuer,
      sid: sessionId,
      sub: userId,
      ver: tokenVersion,
    } satisfies AccessTokenClaims);
    const content = `${header}.${payload}`;
    return `${content}.${this.sign(content, this.accessSecret)}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: '登录状态无效' });
    }
    const [header, payload, signature] = parts as [string, string, string];
    const headerValue = parseJson<{ alg?: unknown; typ?: unknown }>(header);
    const claims = parseJson<Partial<AccessTokenClaims>>(payload);
    const expected = this.sign(`${header}.${payload}`, this.accessSecret);
    if (
      headerValue?.alg !== 'HS256' ||
      headerValue.typ !== 'JWT' ||
      !this.safeEqual(signature, expected) ||
      typeof claims?.sub !== 'string' ||
      typeof claims.sid !== 'string' ||
      typeof claims.exp !== 'number' ||
      typeof claims.iat !== 'number' ||
      typeof claims.ver !== 'number' ||
      claims.iss !== this.issuer ||
      claims.aud !== this.audience ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: '登录状态无效或已过期' });
    }
    return claims as AccessTokenClaims;
  }

  createRefreshSecret(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.refreshSecret).update(token).digest('hex');
  }

  safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private sign(content: string, secret: string): string {
    return createHmac('sha256', secret).update(content).digest('base64url');
  }
}
