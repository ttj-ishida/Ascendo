import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { recordAiUsage } from '../admin/service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { ChatMessage } from '../../types.ts';

export interface PlansServiceDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
}

export async function chatTurn(
  deps: PlansServiceDeps,
  params: { targetLang: string; messages: ChatMessage[]; userId: string },
): Promise<{ reply: string; readyToGenerate: boolean }> {
  if (params.messages.length === 0) {
    throw new AppError('INVALID_MESSAGES', 'messages must not be empty');
  }

  const result = await deps.aiAdapter.chat(params.messages);

  await recordAiUsage(deps, {
    profileId: params.userId,
    purpose: 'plan_chat',
    provider: 'claude',
  });

  return result;
}

export interface CreatePlanDeps extends PlansServiceDeps {
  userClient: SupabaseClient;
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

  const planJson = await deps.aiAdapter.generatePlan(params.messages, params.targetLang);

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

  await recordAiUsage(deps, { profileId: params.userId, learningPlanId: row.id, purpose: 'plan_generation', provider: 'claude' });

  return {
    id: row.id,
    targetLang: row.target_lang,
    status: 'active',
    planJson: row.plan_json,
    createdAt: row.created_at,
  };
}
