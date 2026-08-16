import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/lib/supabase';
import { forgotPasswordSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '入力内容を確認してください');
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(result.data.email, {
      // See sign-up.tsx / oauth.ts for why Linking.createURL is required instead of a
      // hardcoded 'ascendo://...' — Expo Go does not own that custom scheme.
      redirectTo: Linking.createURL('reset-password'),
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>リセット用メールを送信しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error ?? undefined} />
      <PrimaryButton title="リセットメールを送信" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  title: { ...typography.subheading, color: colors.text, textAlign: 'center' },
});
