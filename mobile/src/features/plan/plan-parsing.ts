import type { LearningPlanJSON } from '../../types/plan';

const REQUIRED_FIELDS = ['goal', 'currentLevel', 'weeklyAvailableHours', 'phases', 'contentGroupIds'] as const;

export function parsePlanJson(raw: unknown): LearningPlanJSON | null {
  if (typeof raw !== 'object' || raw === null) return null;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in raw)) return null;
  }
  return raw as LearningPlanJSON;
}

export function computeOverallProgress(plan: LearningPlanJSON): number {
  const allMonthlyTasks = plan.phases.flatMap((phase) => phase.monthlyTasks);
  if (allMonthlyTasks.length === 0) return 0;
  const done = allMonthlyTasks.filter((task) => task.done).length;
  return done / allMonthlyTasks.length;
}
