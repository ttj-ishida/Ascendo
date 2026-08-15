import { computeScore } from '../scoring';

test('computes correct/total/percent from a list of records', () => {
  const result = computeScore([{ is_correct: true }, { is_correct: true }, { is_correct: false }, { is_correct: true }]);
  expect(result).toEqual({ correct: 3, total: 4, percent: 75 });
});

test('returns percent 0 for an empty record list (avoids division by zero)', () => {
  expect(computeScore([])).toEqual({ correct: 0, total: 0, percent: 0 });
});

test('rounds percent to the nearest whole number', () => {
  const result = computeScore([{ is_correct: true }, { is_correct: false }, { is_correct: false }]);
  expect(result.percent).toBe(33);
});
