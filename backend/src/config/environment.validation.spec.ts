import { describe, expect, it } from 'vitest';

import { NodeEnvironment, validateEnvironment } from './environment.validation';

const validConfiguration = {
  DATABASE_URL: 'postgresql://foodtrace:test@127.0.0.1:5432/foodtrace',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-also-different',
};

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    const config = validateEnvironment(validConfiguration);

    expect(config.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.API_PREFIX).toBe('api/v1');
    expect(config.SWAGGER_ENABLED).toBe(true);
  });

  it('rejects placeholders and equal JWT secrets', () => {
    expect(() =>
      validateEnvironment({ ...validConfiguration, DATABASE_URL: 'postgresql://REPLACE_ME' }),
    ).toThrow('DATABASE_URL');
    expect(() =>
      validateEnvironment({
        ...validConfiguration,
        JWT_REFRESH_SECRET: validConfiguration.JWT_ACCESS_SECRET,
      }),
    ).toThrow('JWT secrets must be different');
  });

  it('uses production-safe Swagger default and requires CORS allowlist', () => {
    expect(() =>
      validateEnvironment({ ...validConfiguration, NODE_ENV: 'production' }),
    ).toThrow('production CORS_ORIGINS is required');

    const config = validateEnvironment({
      ...validConfiguration,
      CORS_ORIGINS: 'https://app.example.com',
      NODE_ENV: 'production',
    });
    expect(config.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects wildcard CORS and incomplete optional integrations', () => {
    expect(() => validateEnvironment({ ...validConfiguration, CORS_ORIGINS: '*' })).toThrow(
      'explicit origins',
    );
    expect(() =>
      validateEnvironment({ ...validConfiguration, WECHAT_MINI_LOGIN_ENABLED: 'true' }),
    ).toThrow('WECHAT_MINI_APP_ID');
    expect(() =>
      validateEnvironment({ ...validConfiguration, TENCENT_COS_ENABLED: 'true' }),
    ).toThrow('TENCENT_COS_BUCKET');
  });

  it('rejects invalid ports and TTLs', () => {
    expect(() => validateEnvironment({ ...validConfiguration, PORT: 'not-a-port' })).toThrow(
      'Environment validation failed',
    );
    expect(() =>
      validateEnvironment({ ...validConfiguration, JWT_ACCESS_TTL_SECONDS: 0 }),
    ).toThrow('Environment validation failed');
  });
});
