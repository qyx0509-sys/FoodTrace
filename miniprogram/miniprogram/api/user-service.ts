import type { HttpClient } from './http-client';

export interface CurrentUserProfile {
  avatarObjectKey: string | null;
  createdAt: string;
  id: string;
  locale: string;
  nickname: string | null;
  status: 'ACTIVE';
  timezone: string;
  updatedAt: string;
}

export class UserService {
  constructor(private readonly client: Pick<HttpClient, 'request'>) {}

  getMe(): Promise<CurrentUserProfile> {
    return this.client.request({ path: '/users/me' });
  }

  logout(): Promise<void> {
    return this.client.request({ method: 'POST', path: '/auth/logout' });
  }
}
