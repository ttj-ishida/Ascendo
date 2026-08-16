import { parseOAuthCallbackUrl } from '../oauth-callback';

test('extracts access_token and refresh_token from a successful OAuth callback URL', () => {
  const result = parseOAuthCallbackUrl(
    'ascendo://oauth-callback#access_token=abc123&refresh_token=xyz789&token_type=bearer',
  );
  expect(result).toEqual({ accessToken: 'abc123', refreshToken: 'xyz789' });
});

test('returns null when access_token is missing', () => {
  const result = parseOAuthCallbackUrl('ascendo://oauth-callback#refresh_token=xyz789');
  expect(result).toBeNull();
});

test('returns null when refresh_token is missing', () => {
  const result = parseOAuthCallbackUrl('ascendo://oauth-callback#access_token=abc123');
  expect(result).toBeNull();
});

test('returns null for a malformed URL', () => {
  expect(parseOAuthCallbackUrl('not a url')).toBeNull();
});

test('returns null when the user cancels (no fragment at all)', () => {
  expect(parseOAuthCallbackUrl('ascendo://oauth-callback')).toBeNull();
});
