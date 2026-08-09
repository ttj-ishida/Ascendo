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
  const baseAdapter = fakeAdapter();
  const aiAdapter: AiAdapter = { ...baseAdapter, generateSpeech: async (...args) => { speechCalled = true; return baseAdapter.generateSpeech(...args); } };
  const userClient = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'p1', script_text: 'hello', audio_url: 'https://cache/p1.mp3' }, error: null }) }) }),
    }),
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  };

  const result = await generateAudio(
    { aiAdapter, serviceClient: fakeServiceClient() as never, userClient: userClient as never },
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
    { aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never },
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
    () => generateAudio({ aiAdapter: fakeAdapter(), serviceClient: fakeServiceClient() as never, userClient: userClient as never }, { passageId: 'missing' }),
    (err: unknown) => err instanceof AppError && err.code === 'PASSAGE_NOT_FOUND',
  );
});
