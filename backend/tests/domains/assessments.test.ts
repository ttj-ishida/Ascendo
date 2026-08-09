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
