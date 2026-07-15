import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

interface HealthResponseBody {
  data: {
    service: string;
    status: string;
    timestamp: string;
  };
  requestId: string;
  success: true;
}

function isHealthResponseBody(value: unknown): value is HealthResponseBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    'service' in value.data &&
    typeof value.data.service === 'string' &&
    'status' in value.data &&
    typeof value.data.status === 'string' &&
    'timestamp' in value.data &&
    typeof value.data.timestamp === 'string'
  );
}

describe('health endpoint', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
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
      data: { service: 'foodtrace-api', status: 'ok' },
      success: true,
    });
    expect(isHealthResponseBody(body)).toBe(true);
    if (!isHealthResponseBody(body)) {
      throw new Error('Health response body is invalid');
    }
    expect(new Date(body.data.timestamp).toString()).not.toBe('Invalid Date');
  });
});
