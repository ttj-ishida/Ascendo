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

  const draftChain = {
    eq() { return this; },
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then(resolve: (v: { error: null }) => void) { resolve({ error: null }); },
  };

  const createUserClient = () =>
    ({
      rpc: () => Promise.resolve({ data: true, error: null }),
      from: (table: string) => {
        if (table === 'plan_creation_drafts') {
          return { upsert: () => Promise.resolve({ error: null }), delete: () => draftChain, select: () => draftChain };
        }
        if (table === 'content_groups') {
          return { select: () => Promise.resolve({ data: [], error: null }) };
        }
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan-1', target_lang: 'en', plan_json: {}, created_at: 'now' }, error: null }) }) }),
        };
      },
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
