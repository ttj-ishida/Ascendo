export function computeElapsedMinutes(startMs: number, endMs: number): number {
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60_000);
}
