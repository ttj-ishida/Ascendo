import { aggregateAccuracyByDate } from '../aggregate';

test('groups records by date and computes per-day accuracy percent', () => {
  const result = aggregateAccuracyByDate([
    { answered_at: '2026-08-10T09:00:00Z', is_correct: true },
    { answered_at: '2026-08-10T10:00:00Z', is_correct: false },
    { answered_at: '2026-08-11T09:00:00Z', is_correct: true },
  ]);
  expect(result).toEqual([
    { date: '2026-08-10', accuracyPercent: 50 },
    { date: '2026-08-11', accuracyPercent: 100 },
  ]);
});

test('returns an empty array for no records', () => {
  expect(aggregateAccuracyByDate([])).toEqual([]);
});

test('sorts output dates ascending regardless of input order', () => {
  const result = aggregateAccuracyByDate([
    { answered_at: '2026-08-12T09:00:00Z', is_correct: true },
    { answered_at: '2026-08-10T09:00:00Z', is_correct: true },
  ]);
  expect(result.map((r) => r.date)).toEqual(['2026-08-10', '2026-08-12']);
});
