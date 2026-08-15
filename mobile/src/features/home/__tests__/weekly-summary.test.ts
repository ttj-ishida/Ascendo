import { computeWeeklySummary } from '../weekly-summary';

test('sums actual_minutes across the week\'s day logs', () => {
  const result = computeWeeklySummary(
    [{ actual_minutes: 30 }, { actual_minutes: 45 }, { actual_minutes: 0 }],
    { plan_hours: 5 },
  );
  expect(result).toEqual({ actualMinutes: 75, plannedMinutes: 300 });
});

test('returns plannedMinutes 0 when there is no week log yet', () => {
  const result = computeWeeklySummary([{ actual_minutes: 20 }], null);
  expect(result).toEqual({ actualMinutes: 20, plannedMinutes: 0 });
});

test('returns zeros for an empty week', () => {
  expect(computeWeeklySummary([], null)).toEqual({ actualMinutes: 0, plannedMinutes: 0 });
});
