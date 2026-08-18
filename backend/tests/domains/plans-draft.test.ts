import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDraft } from '../../src/domains/plans/service.ts';

function fakeUserClient(result: { data: unknown; error: unknown }) {
  const eqCalls: [string, unknown][] = [];
  return {
    client: {
      from: () => ({
        select: () => ({
          eq(col: string, val: unknown) {
            eqCalls.push([col, val]);
            return this;
          },
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    },
    eqCalls,
  };
}

test('getDraft returns the persisted messages/readyToGenerate when a draft exists', async () => {
  const { client } = fakeUserClient({
    data: { messages: [{ role: 'user', content: 'hi' }], ready_to_generate: true },
    error: null,
  });

  const result = await getDraft({ userClient: client as never }, { userId: 'u1', targetLang: 'en' });

  assert.deepEqual(result, { messages: [{ role: 'user', content: 'hi' }], readyToGenerate: true });
});

test('getDraft returns null when there is no draft yet (not an error)', async () => {
  const { client } = fakeUserClient({ data: null, error: null });

  const result = await getDraft({ userClient: client as never }, { userId: 'u1', targetLang: 'en' });

  assert.equal(result, null);
});

test('getDraft throws on a query error', async () => {
  const { client } = fakeUserClient({ data: null, error: { message: 'boom' } });

  await assert.rejects(() => getDraft({ userClient: client as never }, { userId: 'u1', targetLang: 'en' }));
});

test('getDraft filters by both profile_id and target_lang', async () => {
  const { client, eqCalls } = fakeUserClient({ data: null, error: null });

  await getDraft({ userClient: client as never }, { userId: 'u1', targetLang: 'ja' });

  assert.deepEqual(eqCalls, [
    ['profile_id', 'u1'],
    ['target_lang', 'ja'],
  ]);
});
