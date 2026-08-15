import { nextCycle, pickNextWords } from '../leitner';

test('nextCycle increments on a correct answer', () => {
  expect(nextCycle(2, true)).toBe(3);
});

test('nextCycle resets to 0 on an incorrect answer', () => {
  expect(nextCycle(4, false)).toBe(0);
});

test('nextCycle never goes below 0', () => {
  expect(nextCycle(0, false)).toBe(0);
});

test('pickNextWords prioritizes lower-cycle words first', () => {
  const progress = new Map([
    ['w1', 3],
    ['w2', 0],
    ['w3', 1],
  ]);
  const result = pickNextWords(progress, ['w1', 'w2', 'w3'], 2);
  expect(result).toEqual(['w2', 'w3']);
});

test('pickNextWords treats words with no progress entry as cycle 0 (highest priority)', () => {
  const progress = new Map([['w1', 5]]);
  const result = pickNextWords(progress, ['w1', 'w2'], 1);
  expect(result).toEqual(['w2']);
});

test('pickNextWords returns fewer than count if there are not enough words', () => {
  const result = pickNextWords(new Map(), ['w1'], 5);
  expect(result).toEqual(['w1']);
});
