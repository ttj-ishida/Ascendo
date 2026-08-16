import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { markOnboardingSeen } from '../../src/lib/onboarding-flag';
import { platformStore } from '../../src/lib/platform-secure-store';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function Onboarding() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ascendo</Text>
      <Text style={styles.body}>AIがあなたのレベルに合わせて学習計画を作ります。</Text>
      <PrimaryButton
        title="はじめる"
        onPress={async () => {
          await markOnboardingSeen(platformStore);
          router.replace('/(auth)/signup-or-login');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.heading, color: colors.primary, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.text, marginBottom: spacing.xl, textAlign: 'center' },
});
