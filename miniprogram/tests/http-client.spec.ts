import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, HttpClient, joinUrl } from '../miniprogram/api/http-client';

describe('joinUrl', () => {
  it('joins URLs without duplicate slashes', () => {
    expect(joinUrl('https://api.example.com/', '/health/live')).toBe(
      'https://api.example.com/health/live',
    );
  });
});

describe('HttpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds an access token and unwraps a success response', async () => {
    const request = vi.fn((options: WechatMiniprogram.RequestOption) => {
      options.success?.({
        cookies: [],
        data: { data: { status: 'ok' } },
        errMsg: 'request:ok',
        exception: { reasons: [], retryCount: 0 },
        header: {},
        statusCode: 200,
        profile: {} as WechatMiniprogram.RequestProfile,
        useHttpDNS: false,
      });
      return {} as WechatMiniprogram.RequestTask;
    });
    vi.stubGlobal('wx', { request });
    const client = new HttpClient('https://api.example.com', {
      getAccessToken: (): string => 'temporary-access-token',
    });

    await expect(client.request<{ status: string }>({ path: '/health/live' })).resolves.toEqual({
      status: 'ok',
    });
    const firstRequest = request.mock.calls[0]?.[0];
    expect(firstRequest?.header).toMatchObject({
      Authorization: 'Bearer temporary-access-token',
    });
  });

  it('maps an API error envelope', async () => {
    const request = vi.fn((options: WechatMiniprogram.RequestOption) => {
      options.success?.({
        cookies: [],
        data: {
          error: {
            code: 'AUTH_REQUIRED',
            message: '需要登录',
            requestId: 'request-id',
          },
        },
        errMsg: 'request:ok',
        exception: { reasons: [], retryCount: 0 },
        header: {},
        statusCode: 401,
        profile: {} as WechatMiniprogram.RequestProfile,
        useHttpDNS: false,
      });
      return {} as WechatMiniprogram.RequestTask;
    });
    vi.stubGlobal('wx', { request });
    const client = new HttpClient('https://api.example.com', {
      getAccessToken: (): null => null,
    });

    await expect(client.request({ path: '/me' })).rejects.toEqual(
      new ApiError('AUTH_REQUIRED', '需要登录', 401, 'request-id'),
    );
  });
});
