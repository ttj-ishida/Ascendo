import { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { parsePlanJson, computeOverallProgress } from '../../../src/features/plan/plan-parsing';
import { computeWeeklySummary } from '../../../src/features/home/weekly-summary';
import { formatMinutes, formatPercent } from '../../../src/lib/format';
import { Card } from '../../../src/components/Card';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';
import type { LearningPlanJSON } from '../../../src/types/plan';

export default function Home() {
  const [plan, setPlan] = useState<LearningPlanJSON | null>(null);
  const [weekly, setWeekly] = useState({ actualMinutes: 0, plannedMinutes: 0 });

  useEffect(() => {
    supabase
      .from('learning_plans')
      .select('plan_json')
      .eq('status', 'active')
      .single()
      .then(({ data }) => setPlan(data ? parsePlanJson(data.plan_json) : null));
  }, []);

  useEffect(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    supabase
      .from('plan_day_logs')
      .select('actual_minutes')
      .gte('log_date', weekStartIso)
      .then(({ data }) => setWeekly(computeWeeklySummary(data ?? [], null)));
  }, []);

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  const progress = computeOverallProgress(plan);

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Text style={typography.heading}>{plan.goal}</Text>
        <ProgressBar ratio={progress} />
        <Text style={styles.caption}>全体進捗 {formatPercent(progress)}</Text>
        <Text style={styles.caption}>今週の実績 {formatMinutes(weekly.actualMinutes)}</Text>
      </Card>

      {plan.phases.map((phase) => (
        <Card key={phase.id} style={{ marginTop: spacing.md }}>
          <Text style={typography.subheading}>{phase.name}</Text>
          {phase.weeklyTasks.map((task) => (
            <Text key={task.id} style={styles.taskRow}>・{task.label}</Text>
          ))}
          {phase.monthlyTasks.map((task) => (
            <Text key={task.id} style={styles.taskRow}>{task.done ? '☑' : '☐'} {task.label}</Text>
          ))}
          {phase.milestones.map((m) => (
            <Text key={m.id} style={styles.taskRow}>{m.label}: {m.actualValue ?? '-'} / {m.targetValue}</Text>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  taskRow: { ...typography.body, color: colors.text, marginTop: spacing.xs },
});
