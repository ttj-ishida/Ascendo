import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { callApi } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import { computeScore } from './scoring';
import { Card } from '../../components/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

interface AssessmentItem {
  position: number;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing';
}

export function AssessmentRunner({ sourceGroupIds, onFinished }: { sourceGroupIds: string[]; onFinished: () => void }) {
  const auth = useAuth();
  const [testId, setTestId] = useState<string | null>(null);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<{ is_correct: boolean }[]>([]);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    callApi<{ id: string; items: AssessmentItem[] }>(
      { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
      '/api/v1/assessments',
      { method: 'POST', body: JSON.stringify({ sourceGroupIds, itemCount: 5 }) },
    ).then((result) => {
      setTestId(result.id);
      setItems(result.items);
    });
  }, [auth.status]);

  async function grade(correct: boolean) {
    if (auth.status !== 'signed-in' || !testId) return;
    const item = items[index];
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: item.contentId,
      test_id: testId,
      is_correct: correct,
    });
    const nextRecords = [...records, { is_correct: correct }];
    setRecords(nextRecords);

    if (index + 1 >= items.length) {
      onFinished();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!testId || items.length === 0) {
    return (
      <View style={styles.center}>
        <Text>テストを準備しています...</Text>
      </View>
    );
  }

  const score = computeScore(records);

  return (
    <Card>
      <Text style={typography.subheading}>問題 {index + 1} / {items.length}</Text>
      <Text style={styles.caption}>現在のスコア: {score.correct} / {score.total}({score.percent}%)</Text>
      <View style={styles.row}>
        <Pressable style={styles.choiceButton} onPress={() => grade(false)}><Text>不正解として記録</Text></Pressable>
        <Pressable style={styles.choiceButton} onPress={() => grade(true)}><Text>正解として記録</Text></Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  choiceButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, flex: 1, alignItems: 'center' },
});
