import { Alert, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { deleteAccount } from '../../../src/features/settings/delete-account';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

export default function Settings() {
  const auth = useAuth();
  if (auth.status !== 'signed-in') return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/onboarding');
  }

  function handleDeleteAccount() {
    Alert.alert('退会しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退会する',
        style: 'destructive',
        onPress: async () => {
          if (auth.status !== 'signed-in') return;
          await deleteAccount({ fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken });
          router.replace('/(auth)/onboarding');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={typography.heading}>設定</Text>
      <PrimaryButton title="ログアウト" onPress={handleLogout} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="退会する" onPress={handleDeleteAccount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
});
