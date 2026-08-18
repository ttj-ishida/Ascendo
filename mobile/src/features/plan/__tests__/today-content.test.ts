import { findActivePhase, todaysContentGroupIds } from '../today-content';
import type { LearningPlanJSON } from '../../../types/plan';

function phase(overrides: Partial<LearningPlanJSON['phases'][number]> = {}) {
  return {
    id: 'p1',
    name: 'Phase 1',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    weeklyTasks: [],
    monthlyTasks: [],
    milestones: [],
    ...overrides,
  };
}

function plan(overrides: Partial<LearningPlanJSON> = {}): LearningPlanJSON {
  return {
    goal: 'TOEIC 800',
    currentLevel: 'intermediate',
    weeklyAvailableHours: 5,
    phases: [],
    contentGroupIds: [],
    ...overrides,
  };
}

test('findActivePhase returns the phase whose date range covers today', () => {
  const p = plan({
    phases: [
      phase({ id: 'p1', startDate: '2026-08-01', endDate: '2026-08-31' }),
      phase({ id: 'p2', startDate: '2026-09-01', endDate: '2026-09-30' }),
    ],
  });

  expect(findActivePhase(p, '2026-09-15')?.id).toBe('p2');
});

test('findActivePhase falls back to the nearest upcoming phase when today is before everything', () => {
  const p = plan({
    phases: [
      phase({ id: 'p1', startDate: '2026-09-01', endDate: '2026-09-30' }),
      phase({ id: 'p2', startDate: '2026-10-01', endDate: '2026-10-31' }),
    ],
  });

  expect(findActivePhase(p, '2026-08-01')?.id).toBe('p1');
});

test('findActivePhase falls back to the last phase when today is after everything', () => {
  const p = plan({
    phases: [
      phase({ id: 'p1', startDate: '2026-08-01', endDate: '2026-08-31' }),
      phase({ id: 'p2', startDate: '2026-09-01', endDate: '2026-09-30' }),
    ],
  });

  expect(findActivePhase(p, '2026-12-01')?.id).toBe('p2');
});

test('findActivePhase returns null for a plan with no phases', () => {
  expect(findActivePhase(plan({ phases: [] }), '2026-08-15')).toBeNull();
});

test('todaysContentGroupIds collects the active phase\'s weeklyTask contentGroupIds, deduplicated', () => {
  const p = plan({
    phases: [
      phase({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        weeklyTasks: [
          { id: 'w1', label: 'Vocab', contentGroupId: 'g1' },
          { id: 'w2', label: 'Grammar', contentGroupId: 'g2' },
          { id: 'w3', label: 'More vocab', contentGroupId: 'g1' },
        ],
      }),
    ],
    contentGroupIds: ['g1', 'g2', 'g3'],
  });

  expect(todaysContentGroupIds(p, '2026-08-15').sort()).toEqual(['g1', 'g2']);
});

test('todaysContentGroupIds falls back to the plan-level contentGroupIds when the phase names none', () => {
  const p = plan({
    phases: [phase({ startDate: '2026-08-01', endDate: '2026-08-31', weeklyTasks: [{ id: 'w1', label: 'Vocab' }] })],
    contentGroupIds: ['g1', 'g2'],
  });

  expect(todaysContentGroupIds(p, '2026-08-15')).toEqual(['g1', 'g2']);
});

test('todaysContentGroupIds returns an empty array when neither the phase nor the plan names any group', () => {
  const p = plan({ phases: [phase()], contentGroupIds: [] });

  expect(todaysContentGroupIds(p, '2026-08-15')).toEqual([]);
});
