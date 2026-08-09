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
