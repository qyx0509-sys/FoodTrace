import { authSession } from '../services/auth-session';
import { HttpClient } from './http-client';

export function createApiClient(apiBaseUrl: string): HttpClient {
  return new HttpClient(apiBaseUrl, {
    getAccessToken: () => authSession.getAccessToken(),
    onAuthenticationExpired: (): void => {
      authSession.clear();
      void wx.reLaunch({ url: '/pages/login/index' });
    },
    refreshAccessToken: (): Promise<string | null> => authSession.refreshAccessToken(apiBaseUrl),
  });
}
