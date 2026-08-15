import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { nextCycle, pickNextWords } from '../../../src/features/vocab/leitner';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { Card } from '../../../src/components/Card';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface VocabWord {
  content_id: string;
  target_text: string;
  target_phonetic: string | null;
  native_text: string;
}

export default function Vocab() {
  const auth = useAuth();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;

    supabase.from('learning_plans').select('id').eq('status', 'active').single().then(({ data }) => {
      if (data) setLearningPlanId(data.id);
    });

    Promise.all([
      supabase.from('vocabulary_items').select('content_id, target_text, target_phonetic, native_text'),
      supabase.from('user_vocabulary_progress').select('content_id, cycle').eq('profile_id', auth.userId),
    ]).then(([wordsRes, progressRes]) => {
      const allWords = (wordsRes.data ?? []) as VocabWord[];
      const progressMap = new Map((progressRes.data ?? []).map((p) => [p.content_id, p.cycle]));
      const nextIds = pickNextWords(progressMap, allWords.map((w) => w.content_id), 10);
      setWords(allWords.filter((w) => nextIds.includes(w.content_id)));
    });
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = words[index];

  async function answer(correct: boolean) {
    if (!current || auth.status !== 'signed-in') return;

    const { data: existing } = await supabase
      .from('user_vocabulary_progress')
      .select('cycle')
      .eq('profile_id', auth.userId)
      .eq('content_id', current.content_id)
      .maybeSingle();

    const cycle = nextCycle(existing?.cycle ?? 0, correct);
    await supabase.from('user_vocabulary_progress').upsert({
      profile_id: auth.userId,
      content_id: current.content_id,
      cycle,
      memorized_at: correct ? new Date().toISOString() : null,
    });
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: correct,
    });

    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>今日の単語学習は完了しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <Pressable onPress={() => setRevealed((r) => !r)}>
          <Text style={typography.heading}>{current.target_text}</Text>
          {current.target_phonetic ? <Text style={styles.caption}>{current.target_phonetic}</Text> : null}
          {revealed ? <Text style={[typography.subheading, { marginTop: spacing.md }]}>{current.native_text}</Text> : null}
        </Pressable>
      </Card>
      {revealed ? (
        <View style={styles.row}>
          <PrimaryButton title="わからなかった" onPress={() => answer(false)} />
          <PrimaryButton title="覚えていた" onPress={() => answer(true)} />
        </View>
      ) : (
        <PrimaryButton title="タップして答えを見る" onPress={() => setRevealed(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.md },
});
