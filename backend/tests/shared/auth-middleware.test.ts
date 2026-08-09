import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware, createAdminGuard, type AuthedRequest } from '../../src/shared/auth/middleware.ts';
import { AppError } from '../../src/shared/errors.ts';

function fakeReqRes(headers: Record<string, string> = {}) {
  const req = { header: (name: string) => headers[name.toLowerCase()] } as AuthedRequest;
  const res = {} as never;
  return { req, res };
}

test('authMiddleware rejects a missing Authorization header', async () => {
  const middleware = createAuthMiddleware(async () => ({ sub: 'x' }));
  const { req, res } = fakeReqRes();
  let captured: unknown;
  await middleware(req, res, (err?: unknown) => { captured = err; });

  assert.ok(captured instanceof AppError);
  assert.equal((captured as AppError).code, 'UNAUTHORIZED');
});

test('authMiddleware rejects a token the verifier throws on', async () => {
  const middleware = createAuthMiddleware(async () => { throw new Error('bad token'); });
  const { req, res } = fakeReqRes({ authorization: 'Bearer not-a-real-token' });
  let captured: unknown;
  await middleware(req, res, (err?: unknown) => { captured = err; });

  assert.ok(captured instanceof AppError);
  assert.equal((captured as AppError).code, 'UNAUTHORIZED');
});

test('authMiddleware sets req.user on a valid token', async () => {
  const middleware = createAuthMiddleware(async () => ({ sub: '11111111-1111-1111-1111-111111111111' }));
  const { req, res } = fakeReqRes({ authorization: 'Bearer good-token' });
  let nextCalledWithNoError = false;
  await middleware(req, res, (err?: unknown) => { nextCalledWithNoError = err === undefined; });

  assert.ok(nextCalledWithNoError);
  assert.deepEqual(req.user, { id: '11111111-1111-1111-1111-111111111111', accessToken: 'good-token' });
});

test('adminGuard rejects when isAdmin() resolves false', async () => {
  const guard = createAdminGuard(async () => false);
  const req = { user: { id: 'x', accessToken: 'tok' } } as AuthedRequest;
  let captured: unknown;
  await guard(req, {} as never, (err?: unknown) => { captured = err; });

  assert.ok(captured instanceof AppError);
  assert.equal((captured as AppError).code, 'ADMIN_ONLY');
});

test('adminGuard allows when isAdmin() resolves true', async () => {
  const guard = createAdminGuard(async () => true);
  const req = { user: { id: 'x', accessToken: 'tok' } } as AuthedRequest;
  let nextCalledWithNoError = false;
  await guard(req, {} as never, (err?: unknown) => { nextCalledWithNoError = err === undefined; });

  assert.ok(nextCalledWithNoError);
});
