import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors.ts';
import type { TokenPayload } from './verify.ts';

export interface AuthedRequest extends Request {
  user?: { id: string; accessToken: string };
}

export function createAuthMiddleware(verify: (token: string) => Promise<TokenPayload>): RequestHandler {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      next(new AppError('UNAUTHORIZED', 'Missing bearer token'));
      return;
    }

    try {
      const payload = await verify(token);
      req.user = { id: payload.sub, accessToken: token };
      next();
    } catch {
      next(new AppError('UNAUTHORIZED', 'Invalid or expired token'));
    }
  };
}

export function createAdminGuard(isAdmin: (accessToken: string) => Promise<boolean>): RequestHandler {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const ok = await isAdmin(req.user!.accessToken);
    if (!ok) {
      next(new AppError('ADMIN_ONLY', 'Admin privileges required'));
      return;
    }
    next();
  };
}
