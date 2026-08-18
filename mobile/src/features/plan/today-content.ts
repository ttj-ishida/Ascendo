import type { LearningPhase, LearningPlanJSON } from '../../types/plan';

/** Finds the phase covering "today" (startDate <= today <= endDate, ISO8601 date strings compare
 * correctly as plain strings). If none matches — today is before the plan starts, or after every
 * phase ends — falls back to the nearest upcoming phase, or the last phase if there is no
 * upcoming one, so callers always get a "current" phase to work with rather than nothing. Only
 * returns null when the plan has no phases at all. */
export function findActivePhase(plan: LearningPlanJSON, today: string): LearningPhase | null {
  if (plan.phases.length === 0) return null;

  const withinRange = plan.phases.find((p) => today >= p.startDate && today <= p.endDate);
  if (withinRange) return withinRange;

  const upcoming = [...plan.phases].filter((p) => p.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return upcoming ?? plan.phases[plan.phases.length - 1];
}

/** Content group ids relevant to "today": the active phase's weekly tasks' contentGroupId
 * (deduplicated), falling back to the plan's overall contentGroupIds when the phase names none
 * itself (e.g. a plan generated before this per-phase linking existed). Returns an empty array
 * when neither source has anything to offer — callers should treat that as "no scoping
 * available, show whatever content exists" rather than "show nothing". */
export function todaysContentGroupIds(plan: LearningPlanJSON, today: string): string[] {
  const phase = findActivePhase(plan, today);
  const fromPhase = (phase?.weeklyTasks ?? []).map((t) => t.contentGroupId).filter((id): id is string => Boolean(id));

  const ids = fromPhase.length > 0 ? fromPhase : plan.contentGroupIds;
  return Array.from(new Set(ids));
}
