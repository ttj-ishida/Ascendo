import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { parseOAuthCallbackUrl } from './oauth-callback';

// TODO(OAuth on hold — see docs/frontend_implementation_plan.md "Known issues" section):
// Under Expo Go, Linking.createURL produces exp://<lan-ip>:<port>/--/oauth-callback. Real-device
// testing showed Supabase's authorize endpoint receives this value byte-for-byte correctly (it
// matches an exact entry added to the dashboard's Redirect URLs) yet still falls back to the
// project's default Site URL — while the structurally simpler 'ascendo://oauth-callback' (no
// port, no '--' path segment) matched and worked. This points to a GoTrue-side redirect URL
// parsing/matching gap for exp://host:port/... shapes, not a app-code or config bug. Re-verify
// once testing moves to a Development Build (npx expo run:android), where the real 'ascendo://'
// scheme is registered with the OS and this whole exp:// detour is unnecessary.
const REDIRECT_TO = Linking.createURL('oauth-callback');

/** Opens the provider's OAuth consent screen in an in-app browser, then establishes the
 * resulting Supabase session. Requires the provider to be enabled in the Supabase dashboard
 * (Authentication → Providers) — see docs/frontend_implementation_plan.md for the external
 * setup steps this depends on. NOTE: on hold under Expo Go — see the TODO above REDIRECT_TO. */
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? 'OAuth URL was not returned by Supabase');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
  if (result.type !== 'success' || !result.url) {
    return; // user cancelled or dismissed the browser
  }

  const tokens = parseOAuthCallbackUrl(result.url);
  if (!tokens) {
    throw new Error('OAuth callback did not include a valid session');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (sessionError) {
    throw new Error(sessionError.message);
  }
}
