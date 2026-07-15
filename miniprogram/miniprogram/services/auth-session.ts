import { ApiError, joinUrl } from '../api/http-client';

export interface SessionUser {
  avatarObjectKey: string | null;
  id: string;
  nickname: string | null;
}

interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: SessionUser;
}

interface ApiEnvelope<T> {
  data: T;
  success: true;
}

interface StoredSession extends SessionPayload {
  expiresAt: number;
}

const sessionKey = 'foodtrace:auth-session';
const deviceKey = 'foodtrace:device-id';

function createUuid(): string {
  const random = (): string => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = character === 'x' ? Number.parseInt(random(), 16) : (Number.parseInt(random(), 16) & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getDeviceId(): string {
  const existing: unknown = wx.getStorageSync(deviceKey);
  if (typeof existing === 'string' && /^[0-9a-f-]{36}$/i.test(existing)) {
    return existing;
  }
  const deviceId = createUuid();
  wx.setStorageSync(deviceKey, deviceId);
  return deviceId;
}

function readSession(): StoredSession | null {
  const value: unknown = wx.getStorageSync(sessionKey);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('accessToken' in value) ||
    typeof value.accessToken !== 'string' ||
    !('refreshToken' in value) ||
    typeof value.refreshToken !== 'string' ||
    !('user' in value) ||
    typeof value.user !== 'object' ||
    value.user === null ||
    !('id' in value.user) ||
    typeof value.user.id !== 'string'
  ) {
    return null;
  }
  return value as StoredSession;
}

function requestSession(
  apiBaseUrl: string,
  path: string,
  body: WechatMiniprogram.IAnyObject,
): Promise<SessionPayload> {
  return new Promise((resolve, reject) => {
    wx.request<ApiEnvelope<SessionPayload>>({
      data: body,
      fail: (error) => reject(new ApiError('NETWORK_ERROR', error.errMsg, 0)),
      header: { 'content-type': 'application/json' },
      method: 'POST',
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data.success) {
          resolve(response.data.data);
          return;
        }
        reject(new ApiError('AUTH_FAILED', '登录状态更新失败', response.statusCode));
      },
      timeout: 10_000,
      url: joinUrl(apiBaseUrl, path),
    });
  });
}

class AuthSessionStore {
  private refreshPromise: Promise<string | null> | null = null;

  getAccessToken(): string | null {
    return readSession()?.accessToken ?? null;
  }

  getCurrentUser(): SessionUser | null {
    return readSession()?.user ?? null;
  }

  async loginWithWeChat(apiBaseUrl: string): Promise<SessionUser> {
    const loginResult = await wx.login();
    if (loginResult.code.length === 0) {
      throw new ApiError('WECHAT_CODE_MISSING', '没有取得微信登录凭证', 0);
    }
    const session = await requestSession(apiBaseUrl, '/auth/wechat/mini/login', {
      code: loginResult.code,
      deviceId: getDeviceId(),
      deviceName: 'WeChat Mini Program',
    });
    this.save(session);
    return session.user;
  }

  refreshAccessToken(apiBaseUrl: string): Promise<string | null> {
    if (this.refreshPromise !== null) {
      return this.refreshPromise;
    }
    const refreshToken = readSession()?.refreshToken;
    if (refreshToken === undefined) {
      return Promise.resolve(null);
    }
    this.refreshPromise = requestSession(apiBaseUrl, '/auth/refresh', { refreshToken })
      .then((session) => {
        this.save(session);
        return session.accessToken;
      })
      .catch(() => {
        this.clear();
        return null;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  clear(): void {
    wx.removeStorageSync(sessionKey);
  }

  private save(session: SessionPayload): void {
    wx.setStorageSync(sessionKey, {
      ...session,
      expiresAt: Date.now() + session.expiresIn * 1000,
    } satisfies StoredSession);
  }
}

export const authSession = new AuthSessionStore();
