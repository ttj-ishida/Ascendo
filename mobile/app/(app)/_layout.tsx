import { Redirect, Slot } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/features/auth/AuthContext';
import { determineRedirect } from '../../src/features/auth/guard-logic';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const auth = useAuth();
  const redirect = determineRedirect(auth);
  if (redirect) return <Redirect href={redirect as never} />;

  if (auth.status === 'loading' || (auth.status === 'signed-in' && auth.hasActivePlan === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
