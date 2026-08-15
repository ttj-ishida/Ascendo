import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function UpgradeInfo() {
  return (
    <View style={styles.container}>
      <Text style={typography.subheading}>AI学習計画の無料枠を使い切りました</Text>
      <Text style={styles.body}>有料プラン(Phase 2で提供予定)にご期待ください。それまでは単語・文法・リスニングの学習コンテンツは引き続き無料でご利用いただけます。</Text>
      <PrimaryButton title="ホームに戻る" onPress={() => router.replace('/(app)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  body: { ...typography.body, color: colors.textMuted, marginVertical: spacing.lg, textAlign: 'center' },
});
