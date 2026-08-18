import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { fetchTodaysContentIds } from '../../../src/features/plan/fetch-todays-content-ids';
import { isCorrectChoice } from '../../../src/features/grammar/scoring';
import { Card } from '../../../src/components/Card';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface GrammarQuestion {
  content_id: string;
  question: string;
  choices: string[];
  answer: string;
  explanation: string | null;
}

export default function Grammar() {
  const auth = useAuth();
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    fetchTodaysContentIds().then(async ({ learningPlanId: planId, contentIds }) => {
      setLearningPlanId(planId);

      // contentIds null = no plan-based scoping available (see fetch-todays-content-ids.ts) —
      // fall back to every published question, same as before the plan was wired in.
      let query = supabase.from('grammar_items').select('content_id, question, choices, answer, explanation');
      if (contentIds) query = query.in('content_id', contentIds);

      const { data } = await query;
      setQuestions((data ?? []) as GrammarQuestion[]);
    });
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = questions[index];

  async function selectChoice(choice: string) {
    if (!current || selected || auth.status !== 'signed-in') return;
    setSelected(choice);
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: isCorrectChoice(current.answer, choice),
    });
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>文法問題は以上です</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <Text style={typography.subheading}>{current.question}</Text>
        {current.choices.map((choice) => (
          <Pressable
            key={choice}
            onPress={() => selectChoice(choice)}
            style={[
              styles.choice,
              selected === choice && (isCorrectChoice(current.answer, choice) ? styles.correct : styles.incorrect),
            ]}
          >
            <Text>{choice}</Text>
          </Pressable>
        ))}
        {selected && current.explanation ? <Text style={styles.caption}>{current.explanation}</Text> : null}
      </Card>
      {selected ? (
        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={{ color: colors.primary }}>次へ</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm },
  correct: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  incorrect: { borderColor: colors.danger },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  nextButton: { alignItems: 'center', marginTop: spacing.md },
});
