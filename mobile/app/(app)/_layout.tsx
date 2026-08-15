import { useEffect, useState } from 'react';
import { Redirect, Slot } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/features/auth/AuthContext';
import { determineRedirect } from '../../src/features/auth/guard-logic';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const auth = useAuth();
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase
      .from('learning_plans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => setHasActivePlan((count ?? 0) > 0));
  }, [auth.status]);

  const redirect = determineRedirect({ auth, hasActivePlan });
  if (redirect) return <Redirect href={redirect as never} />;

  if (auth.status === 'loading' || (auth.status === 'signed-in' && hasActivePlan === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
