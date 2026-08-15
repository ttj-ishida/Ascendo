import { parseAuthDeepLink } from '../deep-link';

test('recognizes a signup confirmation link', () => {
  expect(parseAuthDeepLink('ascendo://sign-up-confirm#access_token=abc&type=signup')).toBe('signup-confirm');
});

test('recognizes a password recovery link', () => {
  expect(parseAuthDeepLink('ascendo://reset-password#access_token=abc&type=recovery')).toBe('password-recovery');
});

test('returns null for an unrelated URL', () => {
  expect(parseAuthDeepLink('ascendo://onboarding')).toBeNull();
});

test('returns null for a malformed URL', () => {
  expect(parseAuthDeepLink('not a url')).toBeNull();
});
