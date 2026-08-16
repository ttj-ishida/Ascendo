import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { parseOAuthCallbackUrl } from './oauth-callback';

// Linking.createURL resolves to the right scheme for whichever environment is running:
// exp://<lan-ip>:<port>/--/oauth-callback under Expo Go (dev), ascendo://oauth-callback in a
// standalone/dev-client build. A hardcoded 'ascendo://...' only works in the latter — Expo Go
// does not own that custom scheme, so Android reports "Navigation is unreachable" when Supabase
// tries to hand control back to the app. See docs/frontend_implementation_plan.md for the
// matching Supabase "Redirect URLs" allow-list entry this depends on (exp://** for dev).
const REDIRECT_TO = Linking.createURL('oauth-callback');

/** Opens the provider's OAuth consent screen in an in-app browser, then establishes the
 * resulting Supabase session. Requires the provider to be enabled in the Supabase dashboard
 * (Authentication → Providers) — see docs/frontend_implementation_plan.md for the external
 * setup steps this depends on. */
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
