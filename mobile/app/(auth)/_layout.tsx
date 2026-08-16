import { Redirect, Slot } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/features/auth/AuthContext';
import { colors } from '../../src/theme/colors';

/** Guards the (auth) route group: already-signed-in users are redirected straight to (app),
 * so a logged-in user never lands back on onboarding/sign-up/log-in. Mirrors (app)/_layout.tsx's
 * guard in the opposite direction. */
export default function AuthLayout() {
  const auth = useAuth();
  // TODO(temporary debug log): remove once the Web redirect-loop report is diagnosed.
  console.log('[auth-layout] render', { authStatus: auth.status });

  if (auth.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (auth.status === 'signed-in') {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}
