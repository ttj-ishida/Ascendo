import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordAiUsageParams {
  profileId?: string;
  learningPlanId?: string;
  listeningPassageId?: string;
  purpose: 'plan_generation' | 'plan_chat' | 'tts_generation';
  provider: 'claude' | 'openai';
  estimatedCostUsd?: number;
}

export async function recordAiUsage(
  deps: { serviceClient: Pick<SupabaseClient, 'from'> },
  params: RecordAiUsageParams,
): Promise<void> {
  const { error } = await deps.serviceClient.from('ai_usage_logs').insert({
    profile_id: params.profileId,
    learning_plan_id: params.learningPlanId,
    listening_passage_id: params.listeningPassageId,
    purpose: params.purpose,
    provider: params.provider,
    estimated_cost_usd: params.estimatedCostUsd,
  });

  if (error) {
    throw new Error(`failed to record ai usage: ${error.message}`);
  }
}
