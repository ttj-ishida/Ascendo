import { supabase } from '../../lib/supabase';
import { parsePlanJson } from './plan-parsing';
import { todaysContentGroupIds } from './today-content';

/** Fetches the caller's active learning plan and resolves it to a scoped set of content_ids for
 * "today" via content_group_items, for the Vocab/Grammar/Listening screens to filter their
 * content queries by (previously those screens ignored the plan entirely and just pulled every
 * published item — raised by the user: content should follow the day-by-day plan). Also returns
 * learningPlanId so each screen doesn't need its own separate learning_plans query for the study
 * timer.
 *
 * contentIds is null when no scoping is available — no active plan, a plan with no phases/content
 * groups (e.g. one generated before any content existed in the database), or content_group_items
 * that resolve to nothing. Callers should treat null as "don't filter, show whatever content
 * exists" rather than "show nothing": a brand-new database with unlinked content should still be
 * usable, not empty. */
export async function fetchTodaysContentIds(): Promise<{ learningPlanId: string | null; contentIds: string[] | null }> {
  const { data: planRow } = await supabase.from('learning_plans').select('id, plan_json').eq('status', 'active').single();
  if (!planRow) return { learningPlanId: null, contentIds: null };

  const plan = parsePlanJson(planRow.plan_json);
  if (!plan) return { learningPlanId: planRow.id, contentIds: null };

  const groupIds = todaysContentGroupIds(plan, new Date().toISOString().slice(0, 10));
  if (groupIds.length === 0) return { learningPlanId: planRow.id, contentIds: null };

  const { data: groupItems } = await supabase.from('content_group_items').select('content_id').in('content_group_id', groupIds);
  const contentIds = (groupItems ?? []).map((row) => row.content_id as string);
  return { learningPlanId: planRow.id, contentIds: contentIds.length > 0 ? contentIds : null };
}
