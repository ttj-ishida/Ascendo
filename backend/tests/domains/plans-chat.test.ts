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
