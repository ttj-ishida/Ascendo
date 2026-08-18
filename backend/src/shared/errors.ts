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

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    // AppError (4xx/502) is "expected" application-level rejection (bad auth, quota exhausted,
    // etc.), but previously produced zero server-side output — diagnosing a failing request
    // meant reading the client's network tab only. Logging it here (one line, no stack trace
    // since it's not a bug) keeps the terminal running `npm start` a useful source of truth for
    // "why did that request fail", matching what the client-side api-client.ts now logs too.
    // `details` (e.g. ai-adapter.ts's { cause: String(err) } wrapping the underlying Anthropic/
    // OpenAI SDK error) is sent to the client but was missing from this log line — meaning the
    // one place that actually explains an AI_PROVIDER_ERROR (bad API key, wrong model name, no
    // credits, etc.) only ever showed up in the browser console, never in the backend's own
    // terminal. Logging it here too.
    console.error(
      `[error] ${req.method} ${req.originalUrl} -> ${err.status} ${err.code}: ${err.message}`,
      err.details !== undefined ? err.details : '',
    );
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl} -> 500 INTERNAL_ERROR`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
