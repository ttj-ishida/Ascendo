import { useEffect, useReducer, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { callApi, ApiError } from '../../src/lib/api-client';
import { apiBaseUrl } from '../../src/lib/api-base-url';
import { chatReducer } from '../../src/features/plan-creation/chat-reducer';
import { useAuth } from '../../src/features/auth/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const TARGET_LANG = 'en';

export default function PlanCreation() {
  const auth = useAuth();
  const [state, dispatch] = useReducer(chatReducer, { messages: [], readyToGenerate: false });
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Restores an in-progress conversation from the backend (plan_creation_drafts table), not
  // device storage — this app is offered on both Web and mobile, so a draft that only lived on
  // one device/browser would be lost switching between them (raised by the user explicitly:
  // client-only persistence "doesn't make sense" for a multi-platform service). The backend
  // upserts this draft on every chat turn (see backend/src/domains/plans/service.ts), so the
  // client only needs to fetch it once on mount.
  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    callApi<{ messages: typeof state.messages; readyToGenerate: boolean }>(
      { fetchFn: fetch, baseUrl: apiBaseUrl, accessToken: auth.accessToken },
      `/api/v1/plans/draft?targetLang=${TARGET_LANG}`,
    )
      .then((draft) => {
        if (draft.messages.length > 0) {
          dispatch({ type: 'RESTORE', state: draft });
        }
      })
      .catch((err) => {
        // Non-fatal: a failed restore just means the conversation starts empty, same as a
        // brand-new user. Logged via api-client.ts's own console.error already.
        void err;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status === 'signed-in' ? auth.userId : null]);

  if (auth.status !== 'signed-in') return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/onboarding');
  }

  async function sendMessage() {
    if (auth.status !== 'signed-in' || !input.trim()) return;
    const content = input;
    setInput('');
    dispatch({ type: 'USER_MESSAGE', content });

    try {
      const result = await callApi<{ reply: string; readyToGenerate: boolean }>(
        { fetchFn: fetch, baseUrl: apiBaseUrl, accessToken: auth.accessToken },
        '/api/v1/plans/chat',
        { method: 'POST', body: JSON.stringify({ targetLang: TARGET_LANG, messages: [...state.messages, { role: 'user', content }] }) },
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
        { fetchFn: fetch, baseUrl: apiBaseUrl, accessToken: auth.accessToken },
        '/api/v1/plans',
        { method: 'POST', body: JSON.stringify({ targetLang: TARGET_LANG, messages: state.messages }) },
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
      <Pressable onPress={handleLogout} style={styles.logout}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
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
  logout: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  logoutText: { ...typography.caption, color: colors.textMuted },
  messages: { flex: 1, marginBottom: spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, color: '#fff', borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, color: colors.text, borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
});
