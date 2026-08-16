import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../src/features/auth/AuthContext';
import { supabase } from '../src/lib/supabase';
import { parseAuthDeepLink } from '../src/lib/deep-link';

// On native, Linking's 'url' event only fires when the OS hands the app an external deep link,
// so this handler naturally runs once per real confirmation-link tap. On Web, expo-router drives
// real browser history, and expo-linking's web listener re-fires on every route change — while
// the '#access_token=...&type=signup' fragment from the confirmation link stays attached to the
// address bar across router.replace() calls (browsers don't clear hashes on navigation).
// Without a guard, that reprocesses the same token on every navigation: setSession → replace →
// new 'url' event → setSession → replace → ... an infinite loop (found via real Web testing;
// visible as Chrome's "Throttling navigation to prevent the browser from hanging").
// lastHandledUrl short-circuits re-entrancy from the same exact URL, and stripping the fragment
// after handling it removes the trigger for any further re-fire.
let lastHandledUrl: string | null = null;

async function handleIncomingUrl(url: string) {
  const kind = parseAuthDeepLink(url);
  if (!kind || url === lastHandledUrl) return;
  lastHandledUrl = url;

  const parsed = new URL(url);
  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  if (kind === 'signup-confirm') router.replace('/(app)');
  if (kind === 'password-recovery') router.replace('/(auth)/reset-password');
}

export default function RootLayout() {
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });
    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  );
}
