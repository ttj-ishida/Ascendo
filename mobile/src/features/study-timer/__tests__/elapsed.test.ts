import { computeElapsedMinutes } from '../elapsed';

test('computes whole minutes elapsed between two timestamps', () => {
  const start = Date.UTC(2026, 7, 11, 10, 0, 0);
  const end = Date.UTC(2026, 7, 11, 10, 5, 30);
  expect(computeElapsedMinutes(start, end)).toBe(5);
});

test('floors partial minutes down (does not round up)', () => {
  const start = Date.UTC(2026, 7, 11, 10, 0, 0);
  const end = Date.UTC(2026, 7, 11, 10, 0, 59);
  expect(computeElapsedMinutes(start, end)).toBe(0);
});

test('never returns a negative number, even if end is before start', () => {
  const start = Date.UTC(2026, 7, 11, 10, 5, 0);
  const end = Date.UTC(2026, 7, 11, 10, 0, 0);
  expect(computeElapsedMinutes(start, end)).toBe(0);
});
