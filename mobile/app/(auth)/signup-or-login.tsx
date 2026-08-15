import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function SignupOrLogin() {
  return (
    <View style={styles.container}>
      <PrimaryButton title="新規登録" onPress={() => router.push('/(auth)/sign-up')} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="ログイン" onPress={() => router.push('/(auth)/log-in')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
});
