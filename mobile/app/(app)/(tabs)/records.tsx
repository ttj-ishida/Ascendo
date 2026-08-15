import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { aggregateAccuracyByDate } from '../../../src/features/records/aggregate';
import { formatPercent } from '../../../src/lib/format';
import { Card } from '../../../src/components/Card';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

export default function Records() {
  const auth = useAuth();
  const [trend, setTrend] = useState<{ date: string; accuracyPercent: number }[]>([]);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase
      .from('learning_records')
      .select('answered_at, is_correct')
      .eq('profile_id', auth.userId)
      .order('answered_at', { ascending: true })
      .then(({ data }) => setTrend(aggregateAccuracyByDate(data ?? [])));
  }, [auth.status]);

  return (
    <ScrollView style={styles.container}>
      <Text style={typography.heading}>学習実績</Text>
      {trend.map((day) => (
        <Card key={day.date} style={{ marginTop: spacing.sm }}>
          <Text style={typography.body}>{day.date}</Text>
          <ProgressBar ratio={day.accuracyPercent / 100} />
          <Text style={styles.caption}>正答率 {formatPercent(day.accuracyPercent / 100)}</Text>
        </Card>
      ))}
      {trend.length === 0 ? <Text style={styles.caption}>まだ学習記録がありません</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
