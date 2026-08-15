import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function SignUpConfirm() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>確認メールを送信しました</Text>
      <Text style={styles.body}>メール内のリンクをタップすると自動的にログインされます。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.subheading, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
