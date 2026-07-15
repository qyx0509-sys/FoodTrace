process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] ??= 'postgresql://foodtrace:test@127.0.0.1:5432/foodtrace';
process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret-at-least-32-characters';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-that-is-also-different';
process.env['SWAGGER_ENABLED'] = 'false';
