import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { recordAiUsage } from '../admin/service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';

export interface ContentServiceDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  userClient: SupabaseClient;
}

export async function generateAudio(
  deps: ContentServiceDeps,
  params: { passageId: string; voice?: string; forceRegenerate?: boolean },
): Promise<{ listeningPassageId: string; audioUrl: string; cached: boolean; costUsd?: number }> {
  const { data: passage, error: fetchError } = await deps.userClient
    .from('listening_passages')
    .select('id, script_text, audio_url')
    .eq('id', params.passageId)
    .single();

  if (fetchError || !passage) {
    throw new AppError('PASSAGE_NOT_FOUND', `listening_passages/${params.passageId} not found`);
  }

  if (passage.audio_url && !params.forceRegenerate) {
    return { listeningPassageId: passage.id, audioUrl: passage.audio_url, cached: true };
  }

  const { audioBuffer, costUsd } = await deps.aiAdapter.generateSpeech(passage.script_text, params.voice);

  const storagePath = `listening/${passage.id}.mp3`;
  const { error: uploadError } = await deps.userClient.storage
    .from('listening-audio')
    .upload(storagePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) {
    throw new Error(`failed to upload generated audio: ${uploadError.message}`);
  }

  const audioUrl = `${storagePath}`;
  const { error: updateError } = await deps.userClient
    .from('listening_passages')
    .update({ audio_url: audioUrl })
    .eq('id', passage.id);
  if (updateError) {
    throw new Error(`failed to persist audio_url: ${updateError.message}`);
  }

  await recordAiUsage(deps, { listeningPassageId: passage.id, purpose: 'tts_generation', provider: 'openai', estimatedCostUsd: costUsd });

  return { listeningPassageId: passage.id, audioUrl, cached: false, costUsd };
}
