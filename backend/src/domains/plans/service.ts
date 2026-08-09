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
