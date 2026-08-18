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

function fakeUserClient() {
  const upserted: { row: unknown; options: unknown }[] = [];
  return {
    client: {
      from: () => ({
        upsert: (row: unknown, options: unknown) => {
          upserted.push({ row, options });
          return Promise.resolve({ error: null });
        },
      }),
    },
    upserted,
  };
}

test('chatTurn returns the AI reply and readyToGenerate flag, logs usage, and persists the draft', async () => {
  const { client: serviceClient, inserted } = fakeServiceClient();
  const { client: userClient, upserted } = fakeUserClient();
  const aiAdapter: AiAdapter = {
    chat: async () => ({ reply: 'What is your goal?', readyToGenerate: false }),
    generatePlan: async () => { throw new Error('not used in this test'); },
    generateSpeech: async () => { throw new Error('not used in this test'); },
  };

  const result = await chatTurn(
    { aiAdapter, serviceClient: serviceClient as never, userClient: userClient as never },
    { targetLang: 'en', messages: [{ role: 'user', content: 'I want to learn English' }], userId: '11111111-1111-1111-1111-111111111111' },
  );

  assert.deepEqual(result, { reply: 'What is your goal?', readyToGenerate: false });
  assert.equal(inserted.length, 1);
  assert.equal((inserted[0] as { purpose: string }).purpose, 'plan_chat');

  assert.equal(upserted.length, 1);
  assert.deepEqual(upserted[0].row, {
    profile_id: '11111111-1111-1111-1111-111111111111',
    target_lang: 'en',
    messages: [
      { role: 'user', content: 'I want to learn English' },
      { role: 'assistant', content: 'What is your goal?' },
    ],
    ready_to_generate: false,
  });
  assert.deepEqual(upserted[0].options, { onConflict: 'profile_id,target_lang' });
});

test('chatTurn rejects an empty messages array with INVALID_MESSAGES', async () => {
  const { client: serviceClient } = fakeServiceClient();
  const { client: userClient } = fakeUserClient();
  const aiAdapter: AiAdapter = {
    chat: async () => { throw new Error('should not be called'); },
    generatePlan: async () => { throw new Error('not used'); },
    generateSpeech: async () => { throw new Error('not used'); },
  };

  await assert.rejects(
    () =>
      chatTurn(
        { aiAdapter, serviceClient: serviceClient as never, userClient: userClient as never },
        { targetLang: 'en', messages: [], userId: 'x' },
      ),
    (err: unknown) => err instanceof AppError && err.code === 'INVALID_MESSAGES',
  );
});
