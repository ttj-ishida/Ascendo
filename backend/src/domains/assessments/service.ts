import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';

export interface AssessmentItem {
  position: number;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing';
}

export async function createAssessment(
  deps: { userClient: SupabaseClient },
  params: { userId: string; sourceGroupIds: string[]; itemCount: number },
): Promise<{ id: string; status: 'in_progress'; items: AssessmentItem[] }> {
  const { data: rawCandidates, error: candidatesError } = await deps.userClient
    .from('content_group_items')
    .select('content_id, learning_contents(type)')
    .in('content_group_id', params.sourceGroupIds);

  // Without generated Supabase types (no `supabase gen types typescript` run against the real
  // project yet), supabase-js can't tell this is a to-one join (content_group_items.content_id
  // -> learning_contents.id) and infers `learning_contents` as an array. It's actually always
  // exactly one row per data_model_design.md's FK, so we cast through our own known shape.
  const candidates = (rawCandidates ?? []) as unknown as {
    content_id: string;
    learning_contents: { type: AssessmentItem['contentType'] };
  }[];

  if (candidatesError) {
    throw new Error(`failed to load candidate content: ${candidatesError.message}`);
  }
  if (!candidates || candidates.length === 0) {
    throw new AppError('GROUP_NOT_FOUND', 'No accessible content found for the given sourceGroupIds');
  }
  if (candidates.length < params.itemCount) {
    throw new AppError(
      'INSUFFICIENT_ITEMS',
      `Requested ${params.itemCount} items but only ${candidates.length} are available`,
    );
  }

  const picked = candidates.slice(0, params.itemCount);

  const { data: test, error: testError } = await deps.userClient
    .from('tests')
    .insert({ profile_id: params.userId, source_group_ids: params.sourceGroupIds })
    .select()
    .single();
  if (testError || !test) {
    throw new Error(`failed to create test: ${testError?.message}`);
  }

  const items: AssessmentItem[] = picked.map((c, i) => ({
    position: i + 1,
    contentId: c.content_id,
    contentType: c.learning_contents.type,
  }));

  const { error: itemsError } = await deps.userClient.from('test_items').insert(
    items.map((item) => ({ test_id: test.id, content_id: item.contentId, position: item.position })),
  );
  if (itemsError) {
    throw new Error(`failed to create test_items: ${itemsError.message}`);
  }

  return { id: test.id, status: 'in_progress', items };
}
