import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/lib/supabase';
import { signUpSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitError(null);
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      // Linking.createURL resolves to exp://<lan-ip>:<port>/--/sign-up-confirm under Expo Go
      // and ascendo://sign-up-confirm in a standalone/dev-client build — see oauth.ts for the
      // full explanation. Requires a matching entry in Supabase's Redirect URLs allow-list.
      options: { emailRedirectTo: Linking.createURL('sign-up-confirm') },
    });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace('/(auth)/sign-up-confirm');
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <TextField label="パスワード" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      <TextField label="パスワード(確認)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} />
      {submitError ? <TextField label="" value={submitError} editable={false} error={submitError} /> : null}
      <PrimaryButton title="新規登録" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
});
