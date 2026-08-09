import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, errorHandler, ERROR_CODES } from '../../src/shared/errors.ts';

test('AppError carries the correct HTTP status for its code', () => {
  const err = new AppError('FREE_QUOTA_EXHAUSTED', 'no quota left');
  assert.equal(err.status, 403);
  assert.equal(err.code, 'FREE_QUOTA_EXHAUSTED');
  assert.equal(err.message, 'no quota left');
});

test('errorHandler serializes an AppError into the api_design.md envelope', () => {
  const err = new AppError('ACTIVE_PLAN_EXISTS', 'plan already exists', { targetLang: 'en' });
  let statusCode: number | undefined;
  let jsonBody: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { jsonBody = body; return this; },
  };

  errorHandler(err, {} as never, res as never, (() => {}) as never);

  assert.equal(statusCode, 409);
  assert.deepEqual(jsonBody, {
    error: { code: 'ACTIVE_PLAN_EXISTS', message: 'plan already exists', details: { targetLang: 'en' } },
  });
});

test('errorHandler maps an unknown error to a generic 500', () => {
  let statusCode: number | undefined;
  let jsonBody: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { jsonBody = body; return this; },
  };

  errorHandler(new Error('boom'), {} as never, res as never, (() => {}) as never);

  assert.equal(statusCode, 500);
  assert.deepEqual(jsonBody, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

test('ERROR_CODES matches docs/api_design.md §5-6', () => {
  assert.deepEqual(ERROR_CODES, {
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
  });
});
