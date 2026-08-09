# Ascendo Node.js Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 5 backend REST endpoints defined in `docs/api_design.md`(§4-5) and `docs/auth_design.md` as a `backend/` Express + TypeScript service, with every domain function unit-testable without a real Supabase project, Docker, or paid AI API calls.

**Architecture:** Modular monolith per `docs/api_design.md`§1 — one Express app, one folder per domain (`identity`, `content`, `plans`, `assessments`, `admin`), a `shared/` layer (`errors`, `auth`, `supabase-client`, `ai-adapter`). Every domain service function takes an explicit `deps` object (Supabase clients, AI adapter) as its first argument instead of importing singletons — this is what makes unit tests possible without live infrastructure: tests inject fakes that satisfy the same TypeScript interfaces the real `server.ts` wires up from environment variables.

**Tech Stack:** Node.js 22 + TypeScript, Express 4, `@supabase/supabase-js`, `jose` (JWT/JWKS), `@anthropic-ai/sdk`, `openai`, `tsx` (run TS directly), `node:test` + `node:assert/strict` (no test framework dependency, matches `apps/roadmap-tool`'s existing convention in the sibling StudyEnglish repo)

## Global Constraints

- Every request/response shape, error code, and HTTP status must match `docs/api_design.md`§5 and §5-6 exactly (field names, casing, status codes) — these are the contract the future Expo client will be built against
- No AI provider secret key or Supabase service_role key may appear in source code; they are read from `process.env` only, via `.env` (gitignored) locally
- Every domain service function's first parameter is a `deps` object — no module-level singleton Supabase/AI clients imported directly into service files (this is what keeps them unit-testable)
- Automated tests must not make real network calls to Supabase, Claude, or OpenAI — they inject fakes. A real end-to-end run against the live `ascendo` Supabase project is a manual, human-run step (Task 14), not part of the automated suite
- All 5 endpoints are mounted under `/api/v1` per `docs/api_design.md`§2

---

### Task 1: Project scaffolding + health check endpoint

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/app.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (Task 13 will replace this signature with `createApp(deps: AppDeps)`; this task only needs a `/health` route so the plumbing itself is provable first)

- [ ] **Step 1: Write the failing test**

`backend/tests/app.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';

test('GET /health returns 200 ok', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, { status: 'ok' });

  server.close();
});
```

- [ ] **Step 2: Create `package.json`**

`backend/package.json`:
```json
{
  "name": "ascendo-backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Node.js/TypeScript backend for Ascendo's 5 REST endpoints (docs/api_design.md).",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "tsx --test tests/**/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@supabase/supabase-js": "^2.45.0",
    "express": "^4.21.0",
    "jose": "^5.9.0",
    "openai": "^4.68.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.9.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

`allowImportingTsExtensions`/`noEmit` are required together because every import in this codebase uses an explicit `.ts` extension (Node's `NodeNext` ESM resolution requires it) — without them, `tsc --noEmit` (Task 6 onward) fails with `TS5097` even though `tsx` runs the same files fine at test/dev time. This surfaced the first time `npm run typecheck` was actually run (Task 6), not from reading the config alone — Task 1's steps only ran `npm test`, not `npm run typecheck`, so this was invisible until later.

- [ ] **Step 4: Create `.env.example` and `.gitignore`**

`backend/.env.example`:
```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

`backend/.gitignore`:
```
node_modules/
dist/
.env
```

- [ ] **Step 5: Write the minimal `app.ts`**

`backend/src/app.ts`:
```ts
import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
```

- [ ] **Step 6: Write `server.ts` (production entrypoint, not exercised by tests yet)**

`backend/src/server.ts`:
```ts
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`Ascendo backend listening on port ${port}`);
});
```

- [ ] **Step 7: Install dependencies and run the test**

Run:
```bash
cd backend
npm install
npm test
```
Expected: PASS — `GET /health returns 200 ok`

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json \
        backend/.env.example backend/.gitignore backend/src/app.ts backend/src/server.ts \
        backend/tests/app.test.ts
git commit -m "chore(backend): scaffold Express + TypeScript project with a health check"
```

---

### Task 2: `shared/errors.ts` — AppError and the error-handling middleware

**Files:**
- Create: `backend/src/shared/errors.ts`
- Test: `backend/tests/shared/errors.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ERROR_CODES` (const map), `ErrorCode` (type), `class AppError extends Error` (constructor `(code: ErrorCode, message: string, details?: unknown)`, readonly `status: number`), `errorHandler` (Express error-handling middleware, signature `(err: unknown, req: Request, res: Response, next: NextFunction) => void`). Every later task's routes import `AppError` and throw it; `app.ts` (Task 13) mounts `errorHandler` last.

- [ ] **Step 1: Write the failing test**

`backend/tests/shared/errors.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/shared/errors.ts'`

- [ ] **Step 3: Implement `shared/errors.ts`**

`backend/src/shared/errors.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 4 tests in `shared/errors.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/errors.ts backend/tests/shared/errors.test.ts
git commit -m "feat(backend): add AppError and errorHandler middleware"
```

---

### Task 3: `shared/auth/verify.ts` — JWT verification

**Files:**
- Create: `backend/src/shared/auth/verify.ts`
- Test: `backend/tests/shared/auth-verify.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface TokenPayload { sub: string; role?: string }`, `verifyAccessToken(token: string, getKey: JWTVerifyGetKey, issuer: string): Promise<TokenPayload>`, `createJwksVerifier(supabaseUrl: string): (token: string) => Promise<TokenPayload>` (production wiring — used by `server.ts` in Task 14, fetches Supabase's real JWKS over the network)

- [ ] **Step 1: Write the failing test (using a locally-generated keypair, no network)**

`backend/tests/shared/auth-verify.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { verifyAccessToken } from '../../src/shared/auth/verify.ts';

async function buildLocalJwks() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  return { jwks, privateKey };
}

test('verifyAccessToken accepts a validly-signed token and returns sub/role', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://ascendo.supabase.co/auth/v1')
    .setExpirationTime('1h')
    .sign(privateKey);

  const payload = await verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1');

  assert.equal(payload.sub, '11111111-1111-1111-1111-111111111111');
  assert.equal(payload.role, 'authenticated');
});

test('verifyAccessToken rejects a token signed with the wrong issuer', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://someone-else.supabase.co/auth/v1')
    .setExpirationTime('1h')
    .sign(privateKey);

  await assert.rejects(() => verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1'));
});

test('verifyAccessToken rejects an expired token', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://ascendo.supabase.co/auth/v1')
    .setExpirationTime('-1h')
    .sign(privateKey);

  await assert.rejects(() => verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/shared/auth/verify.ts'`

- [ ] **Step 3: Implement `shared/auth/verify.ts`**

`backend/src/shared/auth/verify.ts`:
```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface TokenPayload {
  sub: string;
  role?: string;
}

export async function verifyAccessToken(
  token: string,
  getKey: JWTVerifyGetKey,
  issuer: string,
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getKey, { issuer });
  if (typeof payload.sub !== 'string') {
    throw new Error('token payload missing "sub" claim');
  }
  return {
    sub: payload.sub,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}

export function createJwksVerifier(supabaseUrl: string): (token: string) => Promise<TokenPayload> {
  const issuer = `${supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return (token: string) => verifyAccessToken(token, jwks, issuer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `shared/auth-verify.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/auth/verify.ts backend/tests/shared/auth-verify.test.ts
git commit -m "feat(backend): add JWT verification (shared/auth/verify.ts)"
```

---

### Task 4: `shared/auth/middleware.ts` — `authMiddleware` and `adminGuard`

**Files:**
- Create: `backend/src/shared/auth/middleware.ts`
- Test: `backend/tests/shared/auth-middleware.test.ts`

**Interfaces:**
- Consumes: `TokenPayload` (Task 3)
- Produces: `interface AuthedRequest extends Request { user?: { id: string; accessToken: string } }`, `createAuthMiddleware(verify: (token: string) => Promise<TokenPayload>): RequestHandler`, `createAdminGuard(isAdmin: (accessToken: string) => Promise<boolean>): RequestHandler`. Every domain route (Tasks 8-12) mounts `authMiddleware` first; `POST /content/listening-passages/:id/audio` additionally mounts `adminGuard`.

- [ ] **Step 1: Write the failing test**

`backend/tests/shared/auth-middleware.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/shared/auth/middleware.ts'`

- [ ] **Step 3: Implement `shared/auth/middleware.ts`**

`backend/src/shared/auth/middleware.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 5 tests in `shared/auth-middleware.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/auth/middleware.ts backend/tests/shared/auth-middleware.test.ts
git commit -m "feat(backend): add authMiddleware and adminGuard"
```

---

### Task 5: `shared/supabase-client.ts` — the two-client split

**Files:**
- Create: `backend/src/shared/supabase-client.ts`
- Test: `backend/tests/shared/supabase-client.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `createUserClient(supabaseUrl: string, anonKey: string, accessToken: string): SupabaseClient`, `createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient`. Task 14 (`server.ts`) calls these with real env vars; every domain service (Tasks 8-12) receives already-built clients through `deps`, never calls these factories itself.

- [ ] **Step 1: Write the failing test**

`backend/tests/shared/supabase-client.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserClient, createServiceClient } from '../../src/shared/supabase-client.ts';

test('createUserClient forwards the caller access token as a Bearer header', () => {
  const client = createUserClient('https://ascendo.supabase.co', 'anon-key', 'user-access-token');
  // @supabase/supabase-js@2.112.2 exposes the configured global headers on client.headers
  // (confirmed by inspecting Object.keys(client) when this task was executed); this is the
  // cheapest way to prove the token was actually wired in without a network call.
  const headers = (client as unknown as { headers: Record<string, string> }).headers;
  assert.equal(headers.Authorization, 'Bearer user-access-token');
});

test('createServiceClient is a distinct client instance from createUserClient', () => {
  const service = createServiceClient('https://ascendo.supabase.co', 'service-role-key');
  const user = createUserClient('https://ascendo.supabase.co', 'anon-key', 'user-access-token');
  assert.notEqual(service, user);
  assert.equal(typeof service.from, 'function');
  assert.equal(typeof user.from, 'function');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/shared/supabase-client.ts'`

- [ ] **Step 3: Implement `shared/supabase-client.ts`**

`backend/src/shared/supabase-client.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createUserClient(supabaseUrl: string, anonKey: string, accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — both tests in `shared/supabase-client.test.ts`. (Executed against `@supabase/supabase-js@2.112.2`: the headers live at `client.headers`, not `client.rest.headers` — confirmed via `console.log(Object.keys(client))`. If a future version moves them again, the test will fail with a clear "Cannot read properties of undefined"; re-inspect and adjust the assertion path.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/supabase-client.ts backend/tests/shared/supabase-client.test.ts
git commit -m "feat(backend): add createUserClient/createServiceClient (two-client split)"
```

---

### Task 6: `shared/ai-adapter.ts` — Claude/OpenAI abstraction + `AiAdapter` interface

**Files:**
- Create: `backend/src/shared/ai-adapter.ts`
- Create: `backend/src/types.ts`
- Test: `backend/tests/shared/ai-adapter.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `backend/src/types.ts`: `interface ChatMessage { role: 'user' | 'assistant'; content: string }`, `interface LearningPlanJSON { goal: string; currentLevel: string; weeklyAvailableHours: number; phases: unknown[]; contentGroupIds: string[]; conversationLog?: ChatMessage[] }` (mirrors `docs/data_model_design.md`§6; `phases` is kept as `unknown[]` here — the full `LearningPhase`/`WeeklyTask`/`MonthlyTask`/`Milestone` shapes are consumed as opaque JSON by the backend, which never inspects their internals, only Claude produces and the Expo client renders them)
  - `backend/src/shared/ai-adapter.ts`: `interface AiAdapter { chat(messages: ChatMessage[]): Promise<{ reply: string; readyToGenerate: boolean }>; generatePlan(messages: ChatMessage[], targetLang: string): Promise<LearningPlanJSON>; generateSpeech(text: string, voice?: string): Promise<{ audioBuffer: Buffer; costUsd: number }> }`, `createAiAdapter(config: { anthropicApiKey: string; openaiApiKey: string }): AiAdapter` (production wiring, used only by `server.ts` in Task 14 — every other task's tests inject a fake `AiAdapter`)

- [ ] **Step 1: Write `types.ts` (no test needed — it's type-only, verified by `tsc` in every other task's test run)**

`backend/src/types.ts`:
```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LearningPlanJSON {
  goal: string;
  currentLevel: string;
  weeklyAvailableHours: number;
  phases: unknown[];
  contentGroupIds: string[];
  conversationLog?: ChatMessage[];
}
```

- [ ] **Step 2: Write the failing test for the parsing helper**

The only genuinely unit-testable logic in this file (without calling a real AI provider) is how a Claude response gets parsed into `LearningPlanJSON` and how provider errors get wrapped. Test that in isolation:

`backend/tests/shared/ai-adapter.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanResponse } from '../../src/shared/ai-adapter.ts';

test('parsePlanResponse extracts LearningPlanJSON from a fenced JSON code block', () => {
  const raw = [
    'Here is your plan:',
    '```json',
    JSON.stringify({
      goal: 'TOEIC 500',
      currentLevel: 'beginner',
      weeklyAvailableHours: 5,
      phases: [],
      contentGroupIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    }),
    '```',
  ].join('\n');

  const plan = parsePlanResponse(raw);

  assert.equal(plan.goal, 'TOEIC 500');
  assert.deepEqual(plan.contentGroupIds, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
});

test('parsePlanResponse throws when no JSON block is present', () => {
  assert.throws(() => parsePlanResponse('sorry, I need more information first'));
});

test('parsePlanResponse throws when the JSON is missing required fields', () => {
  const raw = '```json\n{"goal": "TOEIC 500"}\n```';
  assert.throws(() => parsePlanResponse(raw));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/shared/ai-adapter.ts'`

- [ ] **Step 4: Implement `shared/ai-adapter.ts`**

`backend/src/shared/ai-adapter.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AppError } from './errors.ts';
import type { ChatMessage, LearningPlanJSON } from '../types.ts';

export interface AiAdapter {
  chat(messages: ChatMessage[]): Promise<{ reply: string; readyToGenerate: boolean }>;
  generatePlan(messages: ChatMessage[], targetLang: string): Promise<LearningPlanJSON>;
  generateSpeech(text: string, voice?: string): Promise<{ audioBuffer: Buffer; costUsd: number }>;
}

const REQUIRED_PLAN_FIELDS = ['goal', 'currentLevel', 'weeklyAvailableHours', 'phases', 'contentGroupIds'] as const;

/** Extracts and validates a LearningPlanJSON from Claude's raw text response. */
export function parsePlanResponse(raw: string): LearningPlanJSON {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error('no ```json ... ``` block found in AI response');
  }

  const parsed = JSON.parse(match[1]) as Partial<LearningPlanJSON>;
  for (const field of REQUIRED_PLAN_FIELDS) {
    if (!(field in parsed)) {
      throw new Error(`AI-generated plan is missing required field "${field}"`);
    }
  }

  return parsed as LearningPlanJSON;
}

const READY_TO_GENERATE_MARKER = '[READY_TO_GENERATE]';

export function createAiAdapter(config: { anthropicApiKey: string; openaiApiKey: string }): AiAdapter {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  return {
    async chat(messages) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          system:
            'You are helping a user build an English-learning plan. Ask about their goal, current level, ' +
            `and weekly available hours. Once you have all three, end your reply with exactly the marker ` +
            `${READY_TO_GENERATE_MARKER} on its own line.`,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        const readyToGenerate = text.includes(READY_TO_GENERATE_MARKER);
        return { reply: text.replace(READY_TO_GENERATE_MARKER, '').trim(), readyToGenerate };
      } catch (err) {
        throw new AppError('AI_PROVIDER_ERROR', 'Claude chat request failed', { cause: String(err) });
      }
    },

    async generatePlan(messages, targetLang) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 4096,
          system:
            `Produce a JSON learning plan for target language "${targetLang}" as a single ` +
            '```json ... ``` code block matching the LearningPlanJSON schema. No prose outside the block.',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        return parsePlanResponse(text);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('AI_PROVIDER_ERROR', 'Claude plan generation failed', { cause: String(err) });
      }
    },

    async generateSpeech(text, voice = 'alloy') {
      try {
        const response = await openai.audio.speech.create({ model: 'tts-1', voice, input: text });
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const costUsd = (text.length / 1000) * 0.015; // tts-1 pricing: $0.015 / 1K characters
        return { audioBuffer, costUsd };
      } catch (err) {
        throw new AppError('AI_PROVIDER_ERROR', 'OpenAI TTS request failed', { cause: String(err) });
      }
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `shared/ai-adapter.test.ts`

- [ ] **Step 6: Commit**

```bash
git add backend/src/types.ts backend/src/shared/ai-adapter.ts backend/tests/shared/ai-adapter.test.ts
git commit -m "feat(backend): add AiAdapter (Claude chat/plan, OpenAI TTS) and plan-response parsing"
```

**Note on coverage:** `createAiAdapter`'s actual network calls to Claude/OpenAI are intentionally not exercised by this automated suite (Global Constraints). Task 14 documents a manual, human-run check against the real APIs.

---

### Task 7: `domains/admin/service.ts` — `recordAiUsage`

**Files:**
- Create: `backend/src/domains/admin/service.ts`
- Test: `backend/tests/domains/admin.test.ts`

**Interfaces:**
- Consumes: nothing beyond a Supabase-client-shaped fake
- Produces: `recordAiUsage(deps: { serviceClient: Pick<SupabaseClient, 'from'> }, params: { profileId?: string; learningPlanId?: string; listeningPassageId?: string; purpose: 'plan_generation' | 'plan_chat' | 'tts_generation'; provider: 'claude' | 'openai'; estimatedCostUsd?: number }): Promise<void>`. Tasks 8-10 call this after every AI call.

- [ ] **Step 1: Write the failing test**

`backend/tests/domains/admin.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAiUsage } from '../../src/domains/admin/service.ts';

test('recordAiUsage inserts a row into ai_usage_logs with the given fields', async () => {
  let insertedTable: string | undefined;
  let insertedRow: unknown;
  const serviceClient = {
    from(table: string) {
      insertedTable = table;
      return {
        insert(row: unknown) {
          insertedRow = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  await recordAiUsage(
    { serviceClient: serviceClient as never },
    { profileId: '11111111-1111-1111-1111-111111111111', purpose: 'plan_chat', provider: 'claude' },
  );

  assert.equal(insertedTable, 'ai_usage_logs');
  assert.deepEqual(insertedRow, {
    profile_id: '11111111-1111-1111-1111-111111111111',
    learning_plan_id: undefined,
    listening_passage_id: undefined,
    purpose: 'plan_chat',
    provider: 'claude',
    estimated_cost_usd: undefined,
  });
});

test('recordAiUsage throws if the insert fails', async () => {
  const serviceClient = {
    from: () => ({ insert: () => Promise.resolve({ error: { message: 'db down' } }) }),
  };

  await assert.rejects(() =>
    recordAiUsage({ serviceClient: serviceClient as never }, { purpose: 'tts_generation', provider: 'openai' }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/domains/admin/service.ts'`

- [ ] **Step 3: Implement `domains/admin/service.ts`**

`backend/src/domains/admin/service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordAiUsageParams {
  profileId?: string;
  learningPlanId?: string;
  listeningPassageId?: string;
  purpose: 'plan_generation' | 'plan_chat' | 'tts_generation';
  provider: 'claude' | 'openai';
  estimatedCostUsd?: number;
}

export async function recordAiUsage(
  deps: { serviceClient: Pick<SupabaseClient, 'from'> },
  params: RecordAiUsageParams,
): Promise<void> {
  const { error } = await deps.serviceClient.from('ai_usage_logs').insert({
    profile_id: params.profileId,
    learning_plan_id: params.learningPlanId,
    listening_passage_id: params.listeningPassageId,
    purpose: params.purpose,
    provider: params.provider,
    estimated_cost_usd: params.estimatedCostUsd,
  });

  if (error) {
    throw new Error(`failed to record ai usage: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — both tests in `domains/admin.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/domains/admin/service.ts backend/tests/domains/admin.test.ts
git commit -m "feat(backend): add recordAiUsage (Admin & Ops domain)"
```

---

### Task 8: Learning Plan domain — `POST /api/v1/plans/chat`

**Files:**
- Create: `backend/src/domains/plans/service.ts`
- Create: `backend/src/domains/plans/routes.ts`
- Test: `backend/tests/domains/plans-chat.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` (Task 6), `AiAdapter` (Task 6), `recordAiUsage` (Task 7), `AppError` (Task 2), `AuthedRequest` (Task 4)
- Produces: `chatTurn(deps: { aiAdapter: AiAdapter; serviceClient: Pick<SupabaseClient, 'from'> }, params: { targetLang: string; messages: ChatMessage[]; userId: string }): Promise<{ reply: string; readyToGenerate: boolean }>`, `createPlansRouter(deps: PlansRouterDeps): Router` (this task wires only the `/chat` route; Task 9 adds `POST /` to the same router)

- [ ] **Step 1: Write the failing service-level test**

`backend/tests/domains/plans-chat.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatTurn } from '../../src/domains/plans/service.ts';
import { AppError } from '../../src/shared/errors.ts';
import type { AiAdapter } from '../../src/shared/ai-adapter.ts';

function fakeServiceClient() {
  const inserted: unknown[] = [];
  return {
    client: { from: () => ({ insert: (row: unknown) => { inserted.push(row); return Promise.resolve({ error: null }); } }) },
    inserted,
  };
}

test('chatTurn returns the AI reply and readyToGenerate flag, and logs usage', async () => {
  const { client, inserted } = fakeServiceClient();
  const aiAdapter: AiAdapter = {
    chat: async () => ({ reply: 'What is your goal?', readyToGenerate: false }),
    generatePlan: async () => { throw new Error('not used in this test'); },
    generateSpeech: async () => { throw new Error('not used in this test'); },
  };

  const result = await chatTurn(
    { aiAdapter, serviceClient: client as never },
    { targetLang: 'en', messages: [{ role: 'user', content: 'I want to learn English' }], userId: '11111111-1111-1111-1111-111111111111' },
  );

  assert.deepEqual(result, { reply: 'What is your goal?', readyToGenerate: false });
  assert.equal(inserted.length, 1);
  assert.equal((inserted[0] as { purpose: string }).purpose, 'plan_chat');
});

test('chatTurn rejects an empty messages array with INVALID_MESSAGES', async () => {
  const { client } = fakeServiceClient();
  const aiAdapter: AiAdapter = {
    chat: async () => { throw new Error('should not be called'); },
    generatePlan: async () => { throw new Error('not used'); },
    generateSpeech: async () => { throw new Error('not used'); },
  };

  await assert.rejects(
    () => chatTurn({ aiAdapter, serviceClient: client as never }, { targetLang: 'en', messages: [], userId: 'x' }),
    (err: unknown) => err instanceof AppError && err.code === 'INVALID_MESSAGES',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/domains/plans/service.ts'`

Note: the two `serviceClient: client as never` casts above are required for `npm run typecheck` to pass later (Task 6 discovered that `chatTurn`'s `deps.serviceClient: Pick<SupabaseClient, 'from'>` type-checks a fake's `.from()` return value against the full `PostgrestQueryBuilder` shape, which a minimal test fake never satisfies structurally — the same pattern already used in Task 7's `admin.test.ts`).

- [ ] **Step 3: Implement `domains/plans/service.ts` (chat portion only — `createPlan` is added in Task 9)**

`backend/src/domains/plans/service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { recordAiUsage } from '../admin/service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { ChatMessage } from '../../types.ts';

export interface PlansServiceDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
}

export async function chatTurn(
  deps: PlansServiceDeps,
  params: { targetLang: string; messages: ChatMessage[]; userId: string },
): Promise<{ reply: string; readyToGenerate: boolean }> {
  if (params.messages.length === 0) {
    throw new AppError('INVALID_MESSAGES', 'messages must not be empty');
  }

  const result = await deps.aiAdapter.chat(params.messages);

  await recordAiUsage(deps, {
    profileId: params.userId,
    purpose: 'plan_chat',
    provider: 'claude',
  });

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — both tests in `domains/plans-chat.test.ts`

- [ ] **Step 5: Write the route (no dedicated test yet — Task 13's `app.test.ts` exercises it end-to-end)**

`backend/src/domains/plans/routes.ts`:
```ts
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { chatTurn } from './service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';
import type { ChatMessage } from '../../types.ts';

export interface PlansRouterDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  createUserClient: (accessToken: string) => SupabaseClient;
}

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as { role?: unknown }).role !== undefined &&
        ['user', 'assistant'].includes((m as { role: string }).role) &&
        typeof (m as { content?: unknown }).content === 'string',
    )
  );
}

export function createPlansRouter(deps: PlansRouterDeps): Router {
  const router = Router();

  router.post('/chat', async (req: AuthedRequest, res, next) => {
    try {
      const { targetLang, messages } = req.body as { targetLang?: unknown; messages?: unknown };
      if (typeof targetLang !== 'string' || !isChatMessageArray(messages)) {
        throw new AppError('INVALID_MESSAGES', 'targetLang must be a string and messages must be a ChatMessage[]');
      }

      const result = await chatTurn(deps, { targetLang, messages, userId: req.user!.id });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/plans/service.ts backend/src/domains/plans/routes.ts backend/tests/domains/plans-chat.test.ts
git commit -m "feat(backend): add POST /plans/chat (Learning Plan domain)"
```

---

### Task 9: Learning Plan domain — `POST /api/v1/plans`

**Files:**
- Modify: `backend/src/domains/plans/service.ts`
- Modify: `backend/src/domains/plans/routes.ts`
- Test: `backend/tests/domains/plans-create.test.ts`

**Interfaces:**
- Consumes: `PlansServiceDeps` (Task 8, extended below), `AppError`, `recordAiUsage`, `LearningPlanJSON` (Task 6)
- Produces: `createPlan(deps: PlansServiceDeps & { userClient: SupabaseClient }, params: { userId: string; targetLang: string; messages: ChatMessage[] }): Promise<{ id: string; targetLang: string; status: 'active'; planJson: LearningPlanJSON; createdAt: string }>`

- [ ] **Step 1: Write the failing test**

`backend/tests/domains/plans-create.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlan } from '../../src/domains/plans/service.ts';
import { AppError } from '../../src/shared/errors.ts';
import type { AiAdapter } from '../../src/shared/ai-adapter.ts';
import type { LearningPlanJSON } from '../../src/types.ts';

const SAMPLE_PLAN: LearningPlanJSON = {
  goal: 'TOEIC 500',
  currentLevel: 'beginner',
  weeklyAvailableHours: 5,
  phases: [],
  contentGroupIds: [],
};

function fakeAdapter(plan: LearningPlanJSON = SAMPLE_PLAN): AiAdapter {
  return {
    chat: async () => { throw new Error('not used'); },
    generatePlan: async () => plan,
    generateSpeech: async () => { throw new Error('not used'); },
  };
}

function fakeServiceClient() {
  return { from: () => ({ insert: () => Promise.resolve({ error: null }) }) };
}

test('createPlan consumes the free quota, inserts the plan, and returns it', async () => {
  let rpcCalledWith: unknown;
  const insertedRow = {
    id: 'plan-1', target_lang: 'en', status: 'active', plan_json: SAMPLE_PLAN, created_at: '2026-08-10T00:00:00Z',
  };
  const userClient = {
    rpc: (fn: string, args: unknown) => { rpcCalledWith = { fn, args }; return Promise.resolve({ data: true, error: null }); },
    from: () => ({
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: insertedRow, error: null }) }),
      }),
    }),
  };

  const result = await createPlan(
    { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient(), userClient: userClient as never },
    { userId: '11111111-1111-1111-1111-111111111111', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
  );

  assert.deepEqual(rpcCalledWith, {
    fn: 'try_consume_plan_generation',
    args: { p_user_id: '11111111-1111-1111-1111-111111111111' },
  });
  assert.equal(result.id, 'plan-1');
  assert.equal(result.status, 'active');
  assert.deepEqual(result.planJson, SAMPLE_PLAN);
});

test('createPlan throws FREE_QUOTA_EXHAUSTED when the quota RPC returns false', async () => {
  const userClient = {
    rpc: () => Promise.resolve({ data: false, error: null }),
    from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
  };

  await assert.rejects(
    () =>
      createPlan(
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient(), userClient: userClient as never },
        { userId: 'x', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'FREE_QUOTA_EXHAUSTED',
  );
});

test('createPlan throws ACTIVE_PLAN_EXISTS on a unique-constraint violation (Postgres 23505)', async () => {
  const userClient = {
    rpc: () => Promise.resolve({ data: true, error: null }),
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }),
        }),
      }),
    }),
  };

  await assert.rejects(
    () =>
      createPlan(
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient(), userClient: userClient as never },
        { userId: 'x', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'ACTIVE_PLAN_EXISTS',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `createPlan is not exported`

- [ ] **Step 3: Extend `domains/plans/service.ts` with `createPlan`**

Append to `backend/src/domains/plans/service.ts` (keep the existing `chatTurn` and its imports; add `SupabaseClient` and `LearningPlanJSON` to the existing import lines):
```ts
export interface CreatePlanDeps extends PlansServiceDeps {
  userClient: SupabaseClient;
}

export async function createPlan(
  deps: CreatePlanDeps,
  params: { userId: string; targetLang: string; messages: ChatMessage[] },
): Promise<{ id: string; targetLang: string; status: 'active'; planJson: import('../../types.ts').LearningPlanJSON; createdAt: string }> {
  const { data: quotaOk, error: quotaError } = await deps.userClient.rpc('try_consume_plan_generation', {
    p_user_id: params.userId,
  });
  if (quotaError) {
    throw new Error(`try_consume_plan_generation failed: ${quotaError.message}`);
  }
  if (!quotaOk) {
    throw new AppError('FREE_QUOTA_EXHAUSTED', 'Free plan-generation quota already used');
  }

  const planJson = await deps.aiAdapter.generatePlan(params.messages, params.targetLang);

  const { data: row, error: insertError } = await deps.userClient
    .from('learning_plans')
    .insert({ profile_id: params.userId, target_lang: params.targetLang, plan_json: planJson })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      throw new AppError('ACTIVE_PLAN_EXISTS', `An active plan for "${params.targetLang}" already exists`);
    }
    throw new Error(`failed to insert learning_plan: ${insertError.message}`);
  }

  await recordAiUsage(deps, { profileId: params.userId, learningPlanId: row.id, purpose: 'plan_generation', provider: 'claude' });

  return {
    id: row.id,
    targetLang: row.target_lang,
    status: 'active',
    planJson: row.plan_json,
    createdAt: row.created_at,
  };
}
```

No import changes are needed: `SupabaseClient` is already imported as a type at the top of the file from Task 8, and `LearningPlanJSON` is referenced inline via `import('../../types.ts').LearningPlanJSON` in the return type above, so no new top-level import is required either.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `domains/plans-create.test.ts`, and the 2 pre-existing tests in `domains/plans-chat.test.ts` still pass

- [ ] **Step 5: Add the route**

Add to `backend/src/domains/plans/routes.ts` (no interface changes needed — `PlansRouterDeps` already has `createUserClient`, which is used to build a per-request `userClient` from `req.user.accessToken`; add this handler inside `createPlansRouter`, after the `/chat` route):
```ts
  router.post('/', async (req: AuthedRequest, res, next) => {
    try {
      const { targetLang, messages } = req.body as { targetLang?: unknown; messages?: unknown };
      if (typeof targetLang !== 'string' || !isChatMessageArray(messages)) {
        throw new AppError('INVALID_MESSAGES', 'targetLang must be a string and messages must be a ChatMessage[]');
      }

      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await createPlan(
        { aiAdapter: deps.aiAdapter, serviceClient: deps.serviceClient, userClient },
        { userId: req.user!.id, targetLang, messages },
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });
```
And add `createPlan` to the existing `import { chatTurn } from './service.ts';` line, making it `import { chatTurn, createPlan } from './service.ts';`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/plans/service.ts backend/src/domains/plans/routes.ts backend/tests/domains/plans-create.test.ts
git commit -m "feat(backend): add POST /plans (free-quota consumption, ADR-13 conflict handling)"
```

---

### Task 10: Content Catalog domain — `POST /api/v1/content/listening-passages/:id/audio`

**Files:**
- Create: `backend/src/domains/content/service.ts`
- Create: `backend/src/domains/content/routes.ts`
- Test: `backend/tests/domains/content.test.ts`

**Interfaces:**
- Consumes: `AiAdapter`, `recordAiUsage`, `AppError`
- Produces: `generateAudio(deps: { aiAdapter: AiAdapter; serviceClient: Pick<SupabaseClient, 'from'>; userClient: SupabaseClient }, params: { passageId: string; voice?: string; forceRegenerate?: boolean }): Promise<{ listeningPassageId: string; audioUrl: string; cached: boolean; costUsd?: number }>`

- [ ] **Step 1: Write the failing test**

`backend/tests/domains/content.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAudio } from '../../src/domains/content/service.ts';
import { AppError } from '../../src/shared/errors.ts';
import type { AiAdapter } from '../../src/shared/ai-adapter.ts';

function fakeAdapter(): AiAdapter {
  return {
    chat: async () => { throw new Error('not used'); },
    generatePlan: async () => { throw new Error('not used'); },
    generateSpeech: async () => ({ audioBuffer: Buffer.from('fake-audio'), costUsd: 0.003 }),
  };
}

function fakeServiceClient() {
  return { from: () => ({ insert: () => Promise.resolve({ error: null }) }) };
}

test('generateAudio returns the cached URL without calling the AI adapter when audio_url already exists', async () => {
  let speechCalled = false;
  const aiAdapter: AiAdapter = { ...fakeAdapter(), generateSpeech: async (...args) => { speechCalled = true; return fakeAdapter().generateSpeech(...args); } };
  const userClient = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'p1', script_text: 'hello', audio_url: 'https://cache/p1.mp3' }, error: null }) }) }),
    }),
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  };

  const result = await generateAudio(
    { aiAdapter, serviceClient: fakeServiceClient(), userClient: userClient as never },
    { passageId: 'p1' },
  );

  assert.equal(speechCalled, false);
  assert.deepEqual(result, { listeningPassageId: 'p1', audioUrl: 'https://cache/p1.mp3', cached: true });
});

test('generateAudio calls the AI adapter and uploads when there is no cached audio', async () => {
  const uploaded: unknown[] = [];
  const userClient = {
    from: (table: string) => {
      if (table === 'listening_passages') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'p2', script_text: 'hello', audio_url: null }, error: null }) }) }),
          update: (row: unknown) => ({ eq: () => { uploaded.push(row); return Promise.resolve({ error: null }); } }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  };

  const result = await generateAudio(
    { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient(), userClient: userClient as never },
    { passageId: 'p2' },
  );

  assert.equal(result.cached, false);
  assert.equal(result.listeningPassageId, 'p2');
  assert.ok(result.audioUrl.includes('p2'));
  assert.equal(result.costUsd, 0.003);
  assert.equal(uploaded.length, 1);
});

test('generateAudio throws PASSAGE_NOT_FOUND when the passage does not exist', async () => {
  const userClient = {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) }) }) }),
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  };

  await assert.rejects(
    () => generateAudio({ aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient(), userClient: userClient as never }, { passageId: 'missing' }),
    (err: unknown) => err instanceof AppError && err.code === 'PASSAGE_NOT_FOUND',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/domains/content/service.ts'`

- [ ] **Step 3: Implement `domains/content/service.ts`**

`backend/src/domains/content/service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { recordAiUsage } from '../admin/service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';

export interface ContentServiceDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  userClient: SupabaseClient;
}

export async function generateAudio(
  deps: ContentServiceDeps,
  params: { passageId: string; voice?: string; forceRegenerate?: boolean },
): Promise<{ listeningPassageId: string; audioUrl: string; cached: boolean; costUsd?: number }> {
  const { data: passage, error: fetchError } = await deps.userClient
    .from('listening_passages')
    .select('id, script_text, audio_url')
    .eq('id', params.passageId)
    .single();

  if (fetchError || !passage) {
    throw new AppError('PASSAGE_NOT_FOUND', `listening_passages/${params.passageId} not found`);
  }

  if (passage.audio_url && !params.forceRegenerate) {
    return { listeningPassageId: passage.id, audioUrl: passage.audio_url, cached: true };
  }

  const { audioBuffer, costUsd } = await deps.aiAdapter.generateSpeech(passage.script_text, params.voice);

  const storagePath = `listening/${passage.id}.mp3`;
  const { error: uploadError } = await deps.userClient.storage
    .from('listening-audio')
    .upload(storagePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) {
    throw new Error(`failed to upload generated audio: ${uploadError.message}`);
  }

  const audioUrl = `${storagePath}`;
  const { error: updateError } = await deps.userClient
    .from('listening_passages')
    .update({ audio_url: audioUrl })
    .eq('id', passage.id);
  if (updateError) {
    throw new Error(`failed to persist audio_url: ${updateError.message}`);
  }

  await recordAiUsage(deps, { listeningPassageId: passage.id, purpose: 'tts_generation', provider: 'openai', estimatedCostUsd: costUsd });

  return { listeningPassageId: passage.id, audioUrl, cached: false, costUsd };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `domains/content.test.ts`

- [ ] **Step 5: Write the route**

`backend/src/domains/content/routes.ts`:
```ts
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAudio } from './service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export interface ContentRouterDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createContentRouter(deps: ContentRouterDeps): Router {
  const router = Router();

  router.post('/listening-passages/:id/audio', async (req: AuthedRequest, res, next) => {
    try {
      const { voice, forceRegenerate } = req.body as { voice?: unknown; forceRegenerate?: unknown };
      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await generateAudio(
        { aiAdapter: deps.aiAdapter, serviceClient: deps.serviceClient, userClient },
        {
          passageId: req.params.id,
          voice: typeof voice === 'string' ? voice : undefined,
          forceRegenerate: forceRegenerate === true,
        },
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/content/service.ts backend/src/domains/content/routes.ts backend/tests/domains/content.test.ts
git commit -m "feat(backend): add POST /content/listening-passages/:id/audio (Content Catalog domain)"
```

---

### Task 11: Assessment domain — `POST /api/v1/assessments`

**Files:**
- Create: `backend/src/domains/assessments/service.ts`
- Create: `backend/src/domains/assessments/routes.ts`
- Test: `backend/tests/domains/assessments.test.ts`

**Interfaces:**
- Consumes: `AppError`
- Produces: `createAssessment(deps: { userClient: SupabaseClient }, params: { userId: string; sourceGroupIds: string[]; itemCount: number }): Promise<{ id: string; status: 'in_progress'; items: { position: number; contentId: string; contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing' }[] }>`

- [ ] **Step 1: Write the failing test**

`backend/tests/domains/assessments.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssessment } from '../../src/domains/assessments/service.ts';
import { AppError } from '../../src/shared/errors.ts';

const CANDIDATE_ITEMS = [
  { content_id: 'c1', learning_contents: { type: 'vocabulary' } },
  { content_id: 'c2', learning_contents: { type: 'vocabulary' } },
  { content_id: 'c3', learning_contents: { type: 'grammar' } },
];

function fakeUserClientWithItems(items: typeof CANDIDATE_ITEMS) {
  const testsInsert: unknown[] = [];
  const testItemsInsert: unknown[] = [];
  return {
    from(table: string) {
      if (table === 'content_group_items') {
        return { select: () => ({ in: () => Promise.resolve({ data: items, error: null }) }) };
      }
      if (table === 'tests') {
        return {
          insert: (row: unknown) => ({ select: () => ({ single: () => { testsInsert.push(row); return Promise.resolve({ data: { id: 'test-1', status: 'in_progress' }, error: null }); } }) }),
        };
      }
      if (table === 'test_items') {
        return { insert: (rows: unknown) => { testItemsInsert.push(rows); return Promise.resolve({ error: null }); } };
      }
      throw new Error(`unexpected table ${table}`);
    },
    testsInsert,
    testItemsInsert,
  };
}

test('createAssessment picks itemCount items and creates tests + test_items', async () => {
  const userClient = fakeUserClientWithItems(CANDIDATE_ITEMS);

  const result = await createAssessment(
    { userClient: userClient as never },
    { userId: '11111111-1111-1111-1111-111111111111', sourceGroupIds: ['g1'], itemCount: 2 },
  );

  assert.equal(result.id, 'test-1');
  assert.equal(result.status, 'in_progress');
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((i) => i.position), [1, 2]);
  assert.equal(userClient.testItemsInsert.length, 1);
});

test('createAssessment throws INSUFFICIENT_ITEMS when fewer candidates than itemCount exist', async () => {
  const userClient = fakeUserClientWithItems(CANDIDATE_ITEMS.slice(0, 1));

  await assert.rejects(
    () => createAssessment({ userClient: userClient as never }, { userId: 'x', sourceGroupIds: ['g1'], itemCount: 5 }),
    (err: unknown) => err instanceof AppError && err.code === 'INSUFFICIENT_ITEMS',
  );
});

test('createAssessment throws GROUP_NOT_FOUND when no candidate items are returned at all', async () => {
  const userClient = fakeUserClientWithItems([]);

  await assert.rejects(
    () => createAssessment({ userClient: userClient as never }, { userId: 'x', sourceGroupIds: ['does-not-exist'], itemCount: 1 }),
    (err: unknown) => err instanceof AppError && err.code === 'GROUP_NOT_FOUND',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/domains/assessments/service.ts'`

- [ ] **Step 3: Implement `domains/assessments/service.ts`**

`backend/src/domains/assessments/service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';

export interface AssessmentItem {
  position: number;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing';
}

export async function createAssessment(
  deps: { userClient: SupabaseClient },
  params: { userId: string; sourceGroupIds: string[]; itemCount: number },
): Promise<{ id: string; status: 'in_progress'; items: AssessmentItem[] }> {
  const { data: rawCandidates, error: candidatesError } = await deps.userClient
    .from('content_group_items')
    .select('content_id, learning_contents(type)')
    .in('content_group_id', params.sourceGroupIds);

  // Without generated Supabase types (no `supabase gen types typescript` run against the real
  // project), supabase-js can't tell this is a to-one join (content_group_items.content_id ->
  // learning_contents.id) and infers `learning_contents` as an array under tsc --noEmit. It's
  // actually always exactly one row per data_model_design.md's FK, so cast through our own
  // known shape (found the first time `npm run typecheck` was run for this task).
  const candidates = (rawCandidates ?? []) as unknown as {
    content_id: string;
    learning_contents: { type: AssessmentItem['contentType'] };
  }[];

  if (candidatesError) {
    throw new Error(`failed to load candidate content: ${candidatesError.message}`);
  }
  if (!candidates || candidates.length === 0) {
    throw new AppError('GROUP_NOT_FOUND', 'No accessible content found for the given sourceGroupIds');
  }
  if (candidates.length < params.itemCount) {
    throw new AppError(
      'INSUFFICIENT_ITEMS',
      `Requested ${params.itemCount} items but only ${candidates.length} are available`,
    );
  }

  const picked = candidates.slice(0, params.itemCount);

  const { data: test, error: testError } = await deps.userClient
    .from('tests')
    .insert({ profile_id: params.userId, source_group_ids: params.sourceGroupIds })
    .select()
    .single();
  if (testError || !test) {
    throw new Error(`failed to create test: ${testError?.message}`);
  }

  const items: AssessmentItem[] = picked.map((c, i) => ({
    position: i + 1,
    contentId: c.content_id,
    contentType: c.learning_contents.type,
  }));

  const { error: itemsError } = await deps.userClient.from('test_items').insert(
    items.map((item) => ({ test_id: test.id, content_id: item.contentId, position: item.position })),
  );
  if (itemsError) {
    throw new Error(`failed to create test_items: ${itemsError.message}`);
  }

  return { id: test.id, status: 'in_progress', items };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `domains/assessments.test.ts`

- [ ] **Step 5: Write the route**

`backend/src/domains/assessments/routes.ts`:
```ts
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { createAssessment } from './service.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export interface AssessmentsRouterDeps {
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createAssessmentsRouter(deps: AssessmentsRouterDeps): Router {
  const router = Router();

  router.post('/', async (req: AuthedRequest, res, next) => {
    try {
      const { sourceGroupIds, itemCount } = req.body as { sourceGroupIds?: unknown; itemCount?: unknown };
      if (!Array.isArray(sourceGroupIds) || sourceGroupIds.some((g) => typeof g !== 'string') || typeof itemCount !== 'number') {
        throw new AppError('INSUFFICIENT_ITEMS', 'sourceGroupIds must be a string[] and itemCount a number');
      }

      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await createAssessment(
        { userClient },
        { userId: req.user!.id, sourceGroupIds, itemCount },
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/assessments/service.ts backend/src/domains/assessments/routes.ts backend/tests/domains/assessments.test.ts
git commit -m "feat(backend): add POST /assessments (Assessment domain)"
```

---

### Task 12: Identity & Account domain — `DELETE /api/v1/identity/me`

**Files:**
- Create: `backend/src/domains/identity/service.ts`
- Create: `backend/src/domains/identity/routes.ts`
- Test: `backend/tests/domains/identity.test.ts`

**Interfaces:**
- Consumes: `AppError`
- Produces: `deleteAccount(deps: { serviceClient: { auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string } | null }> } } } }, params: { userId: string; confirmation: string }): Promise<void>`

- [ ] **Step 1: Write the failing test**

`backend/tests/domains/identity.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccount } from '../../src/domains/identity/service.ts';
import { AppError } from '../../src/shared/errors.ts';

test('deleteAccount calls auth.admin.deleteUser when confirmation matches', async () => {
  let deletedId: string | undefined;
  const serviceClient = { auth: { admin: { deleteUser: (id: string) => { deletedId = id; return Promise.resolve({ error: null }); } } } };

  await deleteAccount({ serviceClient }, { userId: '11111111-1111-1111-1111-111111111111', confirmation: 'DELETE' });

  assert.equal(deletedId, '11111111-1111-1111-1111-111111111111');
});

test('deleteAccount rejects a wrong confirmation string without calling deleteUser', async () => {
  let called = false;
  const serviceClient = { auth: { admin: { deleteUser: () => { called = true; return Promise.resolve({ error: null }); } } } };

  await assert.rejects(
    () => deleteAccount({ serviceClient }, { userId: 'x', confirmation: 'delete' }),
    (err: unknown) => err instanceof AppError && err.code === 'CONFIRMATION_MISMATCH',
  );
  assert.equal(called, false);
});

test('deleteAccount surfaces a Supabase error', async () => {
  const serviceClient = { auth: { admin: { deleteUser: () => Promise.resolve({ error: { message: 'user not found' } }) } } };

  await assert.rejects(() => deleteAccount({ serviceClient }, { userId: 'x', confirmation: 'DELETE' }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../../src/domains/identity/service.ts'`

- [ ] **Step 3: Implement `domains/identity/service.ts`**

`backend/src/domains/identity/service.ts`:
```ts
import { AppError } from '../../shared/errors.ts';

export interface IdentityServiceDeps {
  serviceClient: {
    auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string } | null }> } };
  };
}

export async function deleteAccount(
  deps: IdentityServiceDeps,
  params: { userId: string; confirmation: string },
): Promise<void> {
  if (params.confirmation !== 'DELETE') {
    throw new AppError('CONFIRMATION_MISMATCH', 'confirmation must be exactly "DELETE"');
  }

  const { error } = await deps.serviceClient.auth.admin.deleteUser(params.userId);
  if (error) {
    throw new Error(`failed to delete account: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all 3 tests in `domains/identity.test.ts`

- [ ] **Step 5: Write the route**

`backend/src/domains/identity/routes.ts`:
```ts
import { Router } from 'express';
import { AppError } from '../../shared/errors.ts';
import { deleteAccount, type IdentityServiceDeps } from './service.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export function createIdentityRouter(deps: IdentityServiceDeps): Router {
  const router = Router();

  router.delete('/me', async (req: AuthedRequest, res, next) => {
    try {
      const { confirmation } = req.body as { confirmation?: unknown };
      if (typeof confirmation !== 'string') {
        throw new AppError('CONFIRMATION_MISMATCH', 'confirmation must be exactly "DELETE"');
      }

      await deleteAccount(deps, { userId: req.user!.id, confirmation });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/identity/service.ts backend/src/domains/identity/routes.ts backend/tests/domains/identity.test.ts
git commit -m "feat(backend): add DELETE /identity/me (Identity & Account domain)"
```

---

### Task 13: Wire `app.ts` end-to-end and test all 5 endpoints through real HTTP

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/app.test.ts` (replaces the Task 1 version)

**Interfaces:**
- Consumes: everything from Tasks 2-12
- Produces: `interface AppDeps { verify: (token: string) => Promise<TokenPayload>; isAdmin: (accessToken: string) => Promise<boolean>; aiAdapter: AiAdapter; serviceClient: SupabaseClient; createUserClient: (accessToken: string) => SupabaseClient }`, `createApp(deps: AppDeps): express.Express` (final signature — Task 14's `server.ts` is the only caller with real deps)

- [ ] **Step 1: Write the new end-to-end test (replaces Task 1's minimal version)**

`backend/tests/app.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, type AppDeps } from '../src/app.ts';
import type { AiAdapter } from '../src/shared/ai-adapter.ts';

const VALID_TOKEN = 'valid-token-for-user-1';
const USER_ID = '11111111-1111-1111-1111-111111111111';

function buildFakeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const aiAdapter: AiAdapter = {
    chat: async () => ({ reply: 'hi', readyToGenerate: true }),
    generatePlan: async () => ({ goal: 'g', currentLevel: 'l', weeklyAvailableHours: 5, phases: [], contentGroupIds: [] }),
    generateSpeech: async () => ({ audioBuffer: Buffer.from('x'), costUsd: 0.01 }),
  };

  const serviceClient = { from: () => ({ insert: () => Promise.resolve({ error: null }) }) } as never;

  const createUserClient = () =>
    ({
      rpc: () => Promise.resolve({ data: true, error: null }),
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan-1', target_lang: 'en', plan_json: {}, created_at: 'now' }, error: null }) }) }),
      }),
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
    }) as never;

  return {
    verify: async (token: string) => {
      if (token !== VALID_TOKEN) throw new Error('invalid token');
      return { sub: USER_ID };
    },
    isAdmin: async () => false,
    aiAdapter,
    serviceClient,
    createUserClient,
    ...overrides,
  };
}

async function withApp(deps: AppDeps, fn: (baseUrl: string) => Promise<void>) {
  const app = createApp(deps);
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /health still returns 200 with the full app wired', async () => {
  await withApp(buildFakeDeps(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
  });
});

test('POST /api/v1/plans/chat without a token returns 401 UNAUTHORIZED', async () => {
  await withApp(buildFakeDeps(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/plans/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});

test('POST /api/v1/plans/chat with a valid token returns the AI reply', async () => {
  await withApp(buildFakeDeps(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/plans/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${VALID_TOKEN}` },
      body: JSON.stringify({ targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { reply: 'hi', readyToGenerate: true });
  });
});

test('POST /api/v1/plans returns 201 and the created plan', async () => {
  await withApp(buildFakeDeps(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${VALID_TOKEN}` },
      body: JSON.stringify({ targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 201);
  });
});

test('POST /api/v1/content/listening-passages/:id/audio requires admin (403 for non-admin)', async () => {
  await withApp(buildFakeDeps({ isAdmin: async () => false }), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/content/listening-passages/p1/audio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${VALID_TOKEN}` },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.error.code, 'ADMIN_ONLY');
  });
});

test('DELETE /api/v1/identity/me with the wrong confirmation returns 400', async () => {
  await withApp(buildFakeDeps(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/identity/me`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${VALID_TOKEN}` },
      body: JSON.stringify({ confirmation: 'delete' }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'CONFIRMATION_MISMATCH');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `createApp` still has the Task 1 zero-argument signature, so `type AppDeps` doesn't exist and every route returns 404

- [ ] **Step 3: Rewrite `app.ts` to wire all 5 domains behind the deps-based signature**

`backend/src/app.ts`:
```ts
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorHandler } from './shared/errors.ts';
import { createAuthMiddleware, createAdminGuard } from './shared/auth/middleware.ts';
import type { TokenPayload } from './shared/auth/verify.ts';
import type { AiAdapter } from './shared/ai-adapter.ts';
import { createPlansRouter } from './domains/plans/routes.ts';
import { createContentRouter } from './domains/content/routes.ts';
import { createAssessmentsRouter } from './domains/assessments/routes.ts';
import { createIdentityRouter } from './domains/identity/routes.ts';
import type { IdentityServiceDeps } from './domains/identity/service.ts';

export interface AppDeps {
  verify: (token: string) => Promise<TokenPayload>;
  isAdmin: (accessToken: string) => Promise<boolean>;
  aiAdapter: AiAdapter;
  serviceClient: SupabaseClient & IdentityServiceDeps['serviceClient'];
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createApp(deps?: AppDeps) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  if (deps) {
    const authMiddleware = createAuthMiddleware(deps.verify);
    const adminGuard = createAdminGuard(deps.isAdmin);

    const v1 = express.Router();
    v1.use('/plans', authMiddleware, createPlansRouter(deps));
    v1.use('/content', authMiddleware, adminGuard, createContentRouter(deps));
    v1.use('/assessments', authMiddleware, createAssessmentsRouter(deps));
    v1.use('/identity', authMiddleware, createIdentityRouter(deps));

    app.use('/api/v1', v1);
  }

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS — all tests across every file (Tasks 1-13 combined)

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/tests/app.test.ts
git commit -m "feat(backend): wire all 5 endpoints into app.ts, add end-to-end HTTP tests"
```

---

### Task 14: `server.ts` — production wiring from environment variables (manual verification, not automated)

**Files:**
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `AppDeps` (Task 13), `createJwksVerifier` (Task 3), `createUserClient`/`createServiceClient` (Task 5), `createAiAdapter` (Task 6)

- [ ] **Step 1: Rewrite `server.ts` to build real dependencies from `process.env`**

`backend/src/server.ts`:
```ts
import { createApp, type AppDeps } from './app.ts';
import { createJwksVerifier } from './shared/auth/verify.ts';
import { createUserClient, createServiceClient } from './shared/supabase-client.ts';
import { createAiAdapter } from './shared/ai-adapter.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
const openaiApiKey = requireEnv('OPENAI_API_KEY');
const port = Number(process.env.PORT ?? 3000);

const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);

const deps: AppDeps = {
  verify: createJwksVerifier(supabaseUrl),
  isAdmin: async (accessToken: string) => {
    const client = createUserClient(supabaseUrl, anonKey, accessToken);
    const { data, error } = await client.rpc('is_admin');
    return !error && data === true;
  },
  aiAdapter: createAiAdapter({ anthropicApiKey, openaiApiKey }),
  serviceClient,
  createUserClient: (accessToken: string) => createUserClient(supabaseUrl, anonKey, accessToken),
};

const app = createApp(deps);

app.listen(port, () => {
  console.log(`Ascendo backend listening on port ${port}`);
});
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS — no type errors across `src/` and `tests/`

- [ ] **Step 3: Manual verification against the real `ascendo` Supabase project (human-run, not part of the automated suite — requires real API keys)**

This step is **not automated** because it requires real Claude/OpenAI API keys (which cost money per call) and the real `ascendo` Supabase project's anon/service_role keys, none of which belong in an automated test run. Whoever executes this step should:

1. In the `ascendo` Supabase dashboard, create a Storage bucket named `listening-audio` (Storage → New bucket) — Task 10's `generateAudio()` uploads to this bucket, and nothing in `docs/data_model_design.md`'s migrations creates Storage buckets (that's a Storage concern, not a `CREATE TABLE`), so this is a one-time manual step
2. Copy `backend/.env.example` to `backend/.env` and fill in the real values from the `ascendo` Supabase project's dashboard (Settings → API) and from Anthropic/OpenAI account dashboards
3. Run `cd backend && npm start`
4. In another terminal, obtain a real access token by signing up/logging in through `supabase-js` from a scratch script or the Supabase dashboard's "Auth" test tools, then:
   ```bash
   curl -X POST http://localhost:3000/api/v1/plans/chat \
     -H "Authorization: Bearer <real-access-token>" \
     -H "Content-Type: application/json" \
     -d '{"targetLang":"en","messages":[{"role":"user","content":"I want to prepare for a TOEIC test"}]}'
   ```
   Expected: `200` with a real Claude-generated `reply`
5. Confirm a row appeared in `ai_usage_logs` (Supabase dashboard → Table Editor) with `purpose = 'plan_chat'`

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(backend): wire server.ts to real Supabase/Claude/OpenAI from env vars"
```

---

## 完了後の状態

`backend/`に5エンドポイント全て(`POST /plans/chat`, `POST /plans`, `POST /content/listening-passages/:id/audio`, `POST /assessments`, `DELETE /identity/me`)が実装され、Docker・実APIキーなしで`npm test`が自動実行・全パスする状態になる。次のサブシステム(Expoフロントエンド)は、まだ画面・コンポーネント単位の設計がないため、着手前にbrainstormingセッションが必要。
