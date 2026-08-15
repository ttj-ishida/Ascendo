import { parsePlanJson, computeOverallProgress } from '../plan-parsing';
import type { LearningPlanJSON } from '../../../types/plan';

const VALID_PLAN: LearningPlanJSON = {
  goal: 'TOEIC 500',
  currentLevel: 'beginner',
  weeklyAvailableHours: 5,
  contentGroupIds: [],
  phases: [
    {
      id: 'phase-1',
      name: 'Phase 1',
      startDate: '2026-08-01',
      endDate: '2026-12-01',
      weeklyTasks: [],
      monthlyTasks: [
        { id: 'm1', label: '文法診断テスト', month: '2026-08', done: true },
        { id: 'm2', label: '単語1000語', month: '2026-09', done: false },
      ],
      milestones: [],
    },
  ],
};

test('parsePlanJson accepts a well-formed plan', () => {
  expect(parsePlanJson(VALID_PLAN)).toEqual(VALID_PLAN);
});

test('parsePlanJson returns null for missing required fields', () => {
  expect(parsePlanJson({ goal: 'x' })).toBeNull();
});

test('parsePlanJson returns null for non-object input', () => {
  expect(parsePlanJson('not a plan')).toBeNull();
  expect(parsePlanJson(null)).toBeNull();
});

test('computeOverallProgress returns the ratio of completed monthly tasks', () => {
  expect(computeOverallProgress(VALID_PLAN)).toBe(0.5);
});

test('computeOverallProgress returns 0 when there are no monthly tasks at all', () => {
  const empty: LearningPlanJSON = { ...VALID_PLAN, phases: [{ ...VALID_PLAN.phases[0], monthlyTasks: [] }] };
  expect(computeOverallProgress(empty)).toBe(0);
});
