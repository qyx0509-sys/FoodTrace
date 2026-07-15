export interface AuthenticatedUser {
  sessionId: string;
  userId: string;
}

export interface AccessTokenClaims {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sid: string;
  sub: string;
  ver: number;
}

export interface WeChatIdentity {
  openId: string;
  unionId: string | null;
}
