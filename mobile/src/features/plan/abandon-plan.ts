import { supabase } from '../../lib/supabase';

/** Sets the caller's active learning_plans row to 'abandoned', freeing up the ADR-13
 * one-active-plan-per-language slot so a new one can be created. Used by the "学習計画を作り直す"
 * action (Settings) — recreating a plan is a normal part of the product, not just something to
 * do via a one-off SQL statement, per explicit user request. RLS (learning_plans_update) scopes
 * this to rows the caller owns, so no explicit profile_id filter is required for correctness, but
 * it's included anyway to avoid an accidental no-op silently matching zero rows for the wrong
 * reason. */
export async function abandonActivePlan(userId: string): Promise<void> {
  const { error } = await supabase
    .from('learning_plans')
    .update({ status: 'abandoned' })
    .eq('profile_id', userId)
    .eq('status', 'active');
  if (error) {
    throw new Error(`failed to abandon active plan: ${error.message}`);
  }
}
