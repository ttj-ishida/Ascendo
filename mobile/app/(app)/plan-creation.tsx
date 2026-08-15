import { useReducer, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { callApi, ApiError } from '../../src/lib/api-client';
import { chatReducer } from '../../src/features/plan-creation/chat-reducer';
import { useAuth } from '../../src/features/auth/AuthContext';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

export default function PlanCreation() {
  const auth = useAuth();
  const [state, dispatch] = useReducer(chatReducer, { messages: [], readyToGenerate: false });
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (auth.status !== 'signed-in') return null;

  async function sendMessage() {
    if (auth.status !== 'signed-in' || !input.trim()) return;
    const content = input;
    setInput('');
    dispatch({ type: 'USER_MESSAGE', content });

    try {
      const result = await callApi<{ reply: string; readyToGenerate: boolean }>(
        { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
        '/api/v1/plans/chat',
        { method: 'POST', body: JSON.stringify({ targetLang: 'en', messages: [...state.messages, { role: 'user', content }] }) },
      );
      dispatch({ type: 'AI_REPLY', content: result.reply, readyToGenerate: result.readyToGenerate });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    }
  }

  async function generatePlan() {
    if (auth.status !== 'signed-in') return;
    try {
      await callApi(
        { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
        '/api/v1/plans',
        { method: 'POST', body: JSON.stringify({ targetLang: 'en', messages: state.messages }) },
      );
      router.replace('/(app)');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FREE_QUOTA_EXHAUSTED') {
        router.replace('/(app)/upgrade-info');
        return;
      }
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messages}>
        {state.messages.map((m, i) => (
          <Text key={i} style={m.role === 'user' ? styles.userBubble : styles.aiBubble}>{m.content}</Text>
        ))}
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
      {state.readyToGenerate ? (
        <PrimaryButton title="学習計画を作成する" onPress={generatePlan} />
      ) : (
        <>
          <TextField label="" value={input} onChangeText={setInput} placeholder="メッセージを入力" />
          <PrimaryButton title="送信" onPress={sendMessage} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  messages: { flex: 1, marginBottom: spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, color: '#fff', borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, color: colors.text, borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
});
