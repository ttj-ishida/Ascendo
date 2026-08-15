import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../src/features/auth/AuthContext';
import { supabase } from '../src/lib/supabase';
import { parseAuthDeepLink } from '../src/lib/deep-link';

async function handleIncomingUrl(url: string) {
  const kind = parseAuthDeepLink(url);
  if (!kind) return;

  const parsed = new URL(url);
  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
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
