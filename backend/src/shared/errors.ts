import type { Request, Response, NextFunction } from 'express';

export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  ADMIN_ONLY: 403,
  FREE_QUOTA_EXHAUSTED: 403,
  ACTIVE_PLAN_EXISTS: 409,
  GROUP_NOT_FOUND: 404,
  PASSAGE_NOT_FOUND: 404,
  INVALID_MESSAGES: 422,
  INSUFFICIENT_ITEMS: 422,
  CONFIRMATION_MISMATCH: 400,
  AI_PROVIDER_ERROR: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
