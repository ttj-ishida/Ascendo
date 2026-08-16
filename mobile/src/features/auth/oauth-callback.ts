/** Pure: extracts the session tokens from a Supabase OAuth callback URL's fragment.
 * Returns null if either token is missing (e.g. the user cancelled, or the URL is unrelated).
 * Kept in its own file (no supabase/expo-web-browser imports) so it stays unit-testable without
 * Expo config being present — see src/features/auth/oauth.ts for the side-effecting caller. */
export function parseOAuthCallbackUrl(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const parsed = new URL(url);
    const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
