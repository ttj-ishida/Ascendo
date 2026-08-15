export function nextCycle(currentCycle: number, wasCorrect: boolean): number {
  if (!wasCorrect) return 0;
  return currentCycle + 1;
}

export function pickNextWords(progress: Map<string, number>, allWordIds: string[], count: number): string[] {
  return [...allWordIds]
    .sort((a, b) => (progress.get(a) ?? 0) - (progress.get(b) ?? 0))
    .slice(0, count);
}
