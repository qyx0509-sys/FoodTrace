import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

interface HealthResponseBody {
  service: string;
  status: string;
  timestamp: string;
}

function isHealthResponseBody(value: unknown): value is HealthResponseBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'service' in value &&
    typeof value.service === 'string' &&
    'status' in value &&
    typeof value.status === 'string' &&
    'timestamp' in value &&
    typeof value.timestamp === 'string'
  );
}

describe('health endpoint', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports the API process as live', async () => {
    const server: unknown = app.getHttpServer();
    if (!(server instanceof Server)) {
      throw new Error('Nest did not expose an HTTP server');
    }
    const response = await request(server).get('/api/v1/health/live').expect(200);
    const body: unknown = response.body;

    expect(body).toMatchObject({
      service: 'foodtrace-api',
      status: 'ok',
    });
    expect(isHealthResponseBody(body)).toBe(true);
    if (!isHealthResponseBody(body)) {
      throw new Error('Health response body is invalid');
    }
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });
});
