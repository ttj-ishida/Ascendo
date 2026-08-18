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

/** A thenable delete().eq().eq() chain — real supabase-js query builders resolve when awaited
 * at any point in the chain, so `.eq()` returns itself and `.then()` settles immediately. */
function fakeDraftDeleteChain(recordEq: (col: string, val: unknown) => void, error: { code?: string; message: string } | null = null) {
  const chain = {
    eq(col: string, val: unknown) {
      recordEq(col, val);
      return chain;
    },
    then(resolve: (v: { error: unknown }) => void) {
      resolve({ error });
    },
  };
  return chain;
}

function fakeUserClient(opts: {
  rpcResult: { data: unknown; error: unknown };
  insertResult: { data: unknown; error: unknown };
  draftDeleteError?: { code?: string; message: string } | null;
}) {
  const draftDeleteEqCalls: [string, unknown][] = [];
  return {
    client: {
      rpc: (fn: string, args: unknown) => Promise.resolve(opts.rpcResult),
      from: (table: string) => {
        if (table === 'plan_creation_drafts') {
          return { delete: () => fakeDraftDeleteChain((col, val) => draftDeleteEqCalls.push([col, val]), opts.draftDeleteError ?? null) };
        }
        return {
          insert: () => ({
            select: () => ({ single: () => Promise.resolve(opts.insertResult) }),
          }),
        };
      },
    },
    draftDeleteEqCalls,
  };
}

test('createPlan consumes the free quota, inserts the plan, clears the draft, and returns it', async () => {
  const insertedRow = {
    id: 'plan-1', target_lang: 'en', status: 'active', plan_json: SAMPLE_PLAN, created_at: '2026-08-10T00:00:00Z',
  };
  const { client: userClient, draftDeleteEqCalls } = fakeUserClient({
    rpcResult: { data: true, error: null },
    insertResult: { data: insertedRow, error: null },
  });

  const result = await createPlan(
    { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
    { userId: '11111111-1111-1111-1111-111111111111', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
  );

  assert.equal(result.id, 'plan-1');
  assert.equal(result.status, 'active');
  assert.deepEqual(result.planJson, SAMPLE_PLAN);
  assert.deepEqual(draftDeleteEqCalls, [
    ['profile_id', '11111111-1111-1111-1111-111111111111'],
    ['target_lang', 'en'],
  ]);
});

test('createPlan throws FREE_QUOTA_EXHAUSTED when the quota RPC returns false', async () => {
  const { client: userClient } = fakeUserClient({
    rpcResult: { data: false, error: null },
    insertResult: { data: null, error: null },
  });

  await assert.rejects(
    () =>
      createPlan(
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
        { userId: 'x', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'FREE_QUOTA_EXHAUSTED',
  );
});

test('createPlan throws ACTIVE_PLAN_EXISTS on a unique-constraint violation (Postgres 23505)', async () => {
  const { client: userClient } = fakeUserClient({
    rpcResult: { data: true, error: null },
    insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
  });

  await assert.rejects(
    () =>
      createPlan(
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
        { userId: 'x', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'ACTIVE_PLAN_EXISTS',
  );
});
