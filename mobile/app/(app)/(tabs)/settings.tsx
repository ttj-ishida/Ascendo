import { Alert, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { apiBaseUrl } from '../../../src/lib/api-base-url';
import { useAuth, useAuthActions } from '../../../src/features/auth/AuthContext';
import { deleteAccount } from '../../../src/features/settings/delete-account';
import { abandonActivePlan } from '../../../src/features/plan/abandon-plan';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

export default function Settings() {
  const auth = useAuth();
  const { refreshActivePlan } = useAuthActions();
  if (auth.status !== 'signed-in') return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/onboarding');
  }

  function handleRecreatePlan() {
    Alert.alert('学習計画を作り直しますか？', '現在の学習計画は終了扱いになり、新しい計画作成画面に移動します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '作り直す',
        style: 'destructive',
        onPress: async () => {
          if (auth.status !== 'signed-in') return;
          await abandonActivePlan(auth.userId);
          await refreshActivePlan();
          router.replace('/(app)/plan-creation');
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('退会しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退会する',
        style: 'destructive',
        onPress: async () => {
          if (auth.status !== 'signed-in') return;
          await deleteAccount({ fetchFn: fetch, baseUrl: apiBaseUrl, accessToken: auth.accessToken });
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
      <PrimaryButton title="学習計画を作り直す" onPress={handleRecreatePlan} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="退会する" onPress={handleDeleteAccount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
});
