import { describe, expect, it } from 'vitest';

import { NodeEnvironment, validateEnvironment } from './environment.validation';

const validDatabaseUrl = 'postgresql://foodtrace:test@127.0.0.1:5432/foodtrace';

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    const config = validateEnvironment({ DATABASE_URL: validDatabaseUrl });

    expect(config.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.API_PREFIX).toBe('api/v1');
    expect(config.SWAGGER_ENABLED).toBe(true);
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnvironment({})).toThrow('Environment validation failed');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: validDatabaseUrl, PORT: 'not-a-port' }),
    ).toThrow('Environment validation failed');
  });

  it('normalizes an explicit Swagger flag', () => {
    expect(
      validateEnvironment({ DATABASE_URL: validDatabaseUrl, SWAGGER_ENABLED: 'false' })
        .SWAGGER_ENABLED,
    ).toBe(false);
  });
});
