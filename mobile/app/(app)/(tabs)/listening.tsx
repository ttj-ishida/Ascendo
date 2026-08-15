import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { isCorrectChoice } from '../../../src/features/grammar/scoring';
import { Card } from '../../../src/components/Card';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface ListeningQuestion {
  content_id: string;
  question: string;
  choices: string[];
  answer: string;
  listening_passages: { audio_url: string | null };
}

export default function Listening() {
  const auth = useAuth();
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase.from('learning_plans').select('id').eq('status', 'active').single().then(({ data }) => {
      if (data) setLearningPlanId(data.id);
    });
    supabase
      .from('listening_items')
      .select('content_id, question, choices, answer, listening_passages(audio_url)')
      .then(({ data }) => setQuestions((data ?? []) as unknown as ListeningQuestion[]));
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = questions[index];
  // useAudioPlayer must be called unconditionally (Rules of Hooks) — pass null while there's no
  // audio yet or the current question hasn't loaded; the player just stays idle in that case.
  const player = useAudioPlayer(current?.listening_passages.audio_url ?? null);

  function playAudio() {
    player.seekTo(0);
    player.play();
  }

  async function selectChoice(choice: string) {
    if (!current || selected || auth.status !== 'signed-in') return;
    setSelected(choice);
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: isCorrectChoice(current.answer, choice),
    });
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>リスニング問題は以上です</Text>
      </View>
    );
  }

  if (!current.listening_passages.audio_url) {
    return (
      <View style={styles.center}>
        <Text>音源準備中です。しばらくお待ちください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <PrimaryButton title="再生する" onPress={playAudio} />
        <Text style={[typography.subheading, { marginTop: spacing.md }]}>{current.question}</Text>
        {current.choices.map((choice) => (
          <Pressable key={choice} onPress={() => selectChoice(choice)} style={styles.choice}>
            <Text>{choice}</Text>
          </Pressable>
        ))}
      </Card>
      {selected ? (
        <Pressable style={styles.nextButton} onPress={() => { setSelected(null); setIndex((i) => i + 1); }}>
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
  nextButton: { alignItems: 'center', marginTop: spacing.md },
});
