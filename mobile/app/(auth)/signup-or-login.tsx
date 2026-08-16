import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { signInWithProvider } from '../../src/features/auth/oauth';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function SignupOrLogin() {
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null);
    try {
      await signInWithProvider(provider);
      router.replace('/(app)');
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信エラーが発生しました');
    }
  }

  return (
    <View style={styles.container}>
      <PrimaryButton title="新規登録" onPress={() => router.push('/(auth)/sign-up')} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="ログイン" onPress={() => router.push('/(auth)/log-in')} />

      <View style={styles.divider} />

      <PrimaryButton title="Googleでログイン" onPress={() => handleOAuth('google')} />
      {/* Appleでログインは非表示中: Apple Developer Program(有料)への登録待ち。
          再度有効化する際は、この直後に以下を追加するだけでよい:
          <View style={{ height: spacing.md }} /><PrimaryButton title="Appleでログイン" onPress={() => handleOAuth('apple')} /> */}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
});
