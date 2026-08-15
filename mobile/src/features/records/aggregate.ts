export function aggregateAccuracyByDate(
  records: { answered_at: string; is_correct: boolean }[],
): { date: string; accuracyPercent: number }[] {
  const byDate = new Map<string, { correct: number; total: number }>();

  for (const record of records) {
    const date = record.answered_at.slice(0, 10);
    const bucket = byDate.get(date) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (record.is_correct) bucket.correct += 1;
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { correct, total }]) => ({ date, accuracyPercent: Math.round((correct / total) * 100) }));
}
