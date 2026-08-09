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
