export function computeScore(records: { is_correct: boolean }[]): { correct: number; total: number; percent: number } {
  const total = records.length;
  const correct = records.filter((r) => r.is_correct).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent };
}
