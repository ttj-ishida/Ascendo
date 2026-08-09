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
    { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
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
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
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
        { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
        { userId: 'x', targetLang: 'en', messages: [{ role: 'user', content: 'hi' }] },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'ACTIVE_PLAN_EXISTS',
  );
});
