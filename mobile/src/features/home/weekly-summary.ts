export function computeWeeklySummary(
  dayLogs: { actual_minutes: number }[],
  weekLog: { plan_hours: number } | null,
): { actualMinutes: number; plannedMinutes: number } {
  const actualMinutes = dayLogs.reduce((sum, log) => sum + log.actual_minutes, 0);
  const plannedMinutes = weekLog ? weekLog.plan_hours * 60 : 0;
  return { actualMinutes, plannedMinutes };
}
