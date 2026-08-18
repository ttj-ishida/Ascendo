import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanResponse, buildPlanGenerationMessages, buildPlanGenerationSystemPrompt } from '../../src/shared/ai-adapter.ts';

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

test('buildPlanGenerationMessages appends a trailing user turn when the history ends with the assistant', () => {
  const messages = [
    { role: 'user' as const, content: 'I want to learn English' },
    { role: 'assistant' as const, content: 'What is your goal? [READY_TO_GENERATE]' },
  ];

  const result = buildPlanGenerationMessages(messages);

  assert.equal(result.length, 3);
  assert.deepEqual(result.slice(0, 2), messages);
  assert.equal(result[2].role, 'user');
});

test('buildPlanGenerationMessages leaves a history already ending with the user unchanged', () => {
  const messages = [{ role: 'user' as const, content: 'Please generate my plan' }];

  const result = buildPlanGenerationMessages(messages);

  assert.deepEqual(result, messages);
});

test('buildPlanGenerationMessages leaves an empty history unchanged', () => {
  assert.deepEqual(buildPlanGenerationMessages([]), []);
});

test('buildPlanGenerationSystemPrompt names every required LearningPlanJSON field', () => {
  const prompt = buildPlanGenerationSystemPrompt('en', []);

  for (const field of ['goal', 'currentLevel', 'weeklyAvailableHours', 'phases', 'contentGroupIds']) {
    assert.ok(prompt.includes(field), `expected prompt to mention "${field}"`);
  }
});

test('buildPlanGenerationSystemPrompt embeds the given content groups for the AI to choose from', () => {
  const prompt = buildPlanGenerationSystemPrompt('en', [{ id: 'g1', title: 'Basic Vocab', type: 'vocabulary' }]);

  assert.ok(prompt.includes('"id":"g1"'));
  assert.ok(prompt.includes('"title":"Basic Vocab"'));
});

test('buildPlanGenerationSystemPrompt handles an empty content-groups list without erroring', () => {
  const prompt = buildPlanGenerationSystemPrompt('en', []);

  assert.ok(prompt.includes('[]'));
});
