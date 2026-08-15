import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { logInSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitError(null);
    const result = logInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace('/(app)');
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <TextField label="パスワード" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      {submitError ? <TextField label="" value={submitError} editable={false} error={submitError} /> : null}
      <PrimaryButton title="ログイン" onPress={handleSubmit} />
      <PrimaryButton title="パスワードをお忘れですか？" onPress={() => router.push('/(auth)/forgot-password')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
});
