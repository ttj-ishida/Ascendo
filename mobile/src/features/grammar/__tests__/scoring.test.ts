import { isCorrectChoice } from '../scoring';

test('matches when selected equals the correct answer exactly', () => {
  expect(isCorrectChoice('am', 'am')).toBe(true);
});

test('does not match a different choice', () => {
  expect(isCorrectChoice('am', 'is')).toBe(false);
});

test('trims incidental whitespace before comparing', () => {
  expect(isCorrectChoice('am', ' am ')).toBe(true);
});
