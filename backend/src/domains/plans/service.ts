import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { recordAiUsage } from '../admin/service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { ChatMessage, ContentGroupOption } from '../../types.ts';

export interface PlansServiceDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  userClient: Pick<SupabaseClient, 'from'>;
}

export async function chatTurn(
  deps: PlansServiceDeps,
  params: { targetLang: string; messages: ChatMessage[]; userId: string },
): Promise<{ reply: string; readyToGenerate: boolean }> {
  if (params.messages.length === 0) {
    throw new AppError('INVALID_MESSAGES', 'messages must not be empty');
  }

  const result = await deps.aiAdapter.chat(params.messages);

  // Persisted server-side (not just returned to the client) so the conversation survives a
  // reload/relaunch and is resumable from a different device or platform (Web vs mobile) — the
  // whole point of this being a service and not a device-local feature. Upserted against the
  // (profile_id, target_lang) unique index so each chat turn simply replaces the prior draft.
  const fullMessages: ChatMessage[] = [...params.messages, { role: 'assistant', content: result.reply }];
  const { error: draftError } = await deps.userClient.from('plan_creation_drafts').upsert(
    {
      profile_id: params.userId,
      target_lang: params.targetLang,
      messages: fullMessages,
      ready_to_generate: result.readyToGenerate,
    },
    { onConflict: 'profile_id,target_lang' },
  );
  if (draftError) {
    throw new Error(`failed to persist plan_creation_draft: ${draftError.message}`);
  }

  await recordAiUsage(deps, {
    profileId: params.userId,
    purpose: 'plan_chat',
    provider: 'claude',
  });

  return result;
}

/** Fetches the caller's in-progress plan-creation conversation for a target language, if any —
 * powers the screen's "restore on open" behavior. Returns null (not an error) when there is no
 * draft yet, which is the normal case for a brand-new conversation. */
export async function getDraft(
  deps: { userClient: Pick<SupabaseClient, 'from'> },
  params: { userId: string; targetLang: string },
): Promise<{ messages: ChatMessage[]; readyToGenerate: boolean } | null> {
  const { data, error } = await deps.userClient
    .from('plan_creation_drafts')
    .select('messages, ready_to_generate')
    .eq('profile_id', params.userId)
    .eq('target_lang', params.targetLang)
    .maybeSingle();

  if (error) {
    throw new Error(`failed to fetch plan_creation_draft: ${error.message}`);
  }
  if (!data) return null;

  const row = data as { messages: ChatMessage[]; ready_to_generate: boolean };
  return { messages: row.messages, readyToGenerate: row.ready_to_generate };
}

export interface CreatePlanDeps extends PlansServiceDeps {
  userClient: SupabaseClient;
}

/** The content options the AI is allowed to reference (ADR-05: it selects among existing
 * content_groups, it never invents content). Queried via userClient, so RLS already limits the
 * result to published system groups plus the caller's own — no extra filtering needed here. */
async function fetchContentGroupOptions(userClient: Pick<SupabaseClient, 'from'>): Promise<ContentGroupOption[]> {
  const { data, error } = await userClient.from('content_groups').select('id, title, type');
  if (error) {
    throw new Error(`failed to fetch content_groups: ${error.message}`);
  }
  return (data ?? []) as ContentGroupOption[];
}

export async function createPlan(
  deps: CreatePlanDeps,
  params: { userId: string; targetLang: string; messages: ChatMessage[] },
): Promise<{ id: string; targetLang: string; status: 'active'; planJson: import('../../types.ts').LearningPlanJSON; createdAt: string }> {
  const { data: quotaOk, error: quotaError } = await deps.userClient.rpc('try_consume_plan_generation', {
    p_user_id: params.userId,
  });
  if (quotaError) {
    throw new Error(`try_consume_plan_generation failed: ${quotaError.message}`);
  }
  if (!quotaOk) {
    throw new AppError('FREE_QUOTA_EXHAUSTED', 'Free plan-generation quota already used');
  }

  const contentGroups = await fetchContentGroupOptions(deps.userClient);
  const planJson = await deps.aiAdapter.generatePlan(params.messages, params.targetLang, contentGroups);

  const { data: row, error: insertError } = await deps.userClient
    .from('learning_plans')
    .insert({ profile_id: params.userId, target_lang: params.targetLang, plan_json: planJson })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      throw new AppError('ACTIVE_PLAN_EXISTS', `An active plan for "${params.targetLang}" already exists`);
    }
    throw new Error(`failed to insert learning_plan: ${insertError.message}`);
  }

  // The draft's job is done once a real plan exists — clear it so there's nothing left to
  // "resume" into a stale conversation. Best-effort in spirit (the plan itself is already
  // committed at this point) but still surfaced as an error if it fails, since a lingering draft
  // would otherwise silently reappear the next time this screen loads.
  const { error: draftDeleteError } = await deps.userClient
    .from('plan_creation_drafts')
    .delete()
    .eq('profile_id', params.userId)
    .eq('target_lang', params.targetLang);
  if (draftDeleteError) {
    throw new Error(`failed to clear plan_creation_draft: ${draftDeleteError.message}`);
  }

  await recordAiUsage(deps, { profileId: params.userId, learningPlanId: row.id, purpose: 'plan_generation', provider: 'claude' });

  return {
    id: row.id,
    targetLang: row.target_lang,
    status: 'active',
    planJson: row.plan_json,
    createdAt: row.created_at,
  };
}
