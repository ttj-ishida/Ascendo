import { formatMinutes, formatPercent } from '../format';

test('formatMinutes renders under an hour as "N分"', () => {
  expect(formatMinutes(45)).toBe('45分');
});

test('formatMinutes renders an hour or more as "H時間M分"', () => {
  expect(formatMinutes(125)).toBe('2時間5分');
});

test('formatMinutes renders exactly on the hour without a minutes part', () => {
  expect(formatMinutes(120)).toBe('2時間');
});

test('formatPercent rounds to the nearest whole percent', () => {
  expect(formatPercent(0.666)).toBe('67%');
  expect(formatPercent(0)).toBe('0%');
  expect(formatPercent(1)).toBe('100%');
});
