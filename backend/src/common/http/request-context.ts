import type { Request } from 'express';

export interface AuthContext {
  sessionId: string;
  userId: string;
}

export interface RequestContext extends Request {
  auth?: AuthContext;
  requestId?: string;
}
