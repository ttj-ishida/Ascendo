-- Ascendo behavior verification script.
-- Wrapped in begin/rollback: all test fixture data is discarded at the end,
-- leaving the schema (already applied) untouched but the tables empty again.
-- If this script stops partway with an error, tell me which "CHECK n" NOTICE
-- was the last one printed successfully — that tells me exactly where it broke.

begin;

-- Fixtures shared across checks
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'admin1@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');

-- ============================================================
-- CHECK 1: profiles auto-created on signup, with correct defaults
-- ============================================================
do $$
declare
  v_status text;
  v_tier plan_tier;
  v_count int;
begin
  select status, plan_tier, plan_generation_count
    into v_status, v_tier, v_count
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';

  if v_status is distinct from 'active' or v_tier is distinct from 'free' or v_count is distinct from 0 then
    raise exception 'CHECK 1 FAILED: unexpected defaults status=%, plan_tier=%, count=%', v_status, v_tier, v_count;
  end if;

  raise notice 'CHECK 1 PASSED: handle_new_user() created profile with correct defaults';
end $$;

-- ============================================================
-- CHECK 2: protect_plan_tier_columns blocks a non-admin from changing plan_tier
-- ============================================================
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  begin
    update public.profiles set plan_tier = 'paid' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'CHECK 2 FAILED: non-admin was able to change plan_tier';
  exception
    when others then
      if sqlerrm like '%can only be changed by an admin%' then
        raise notice 'CHECK 2 PASSED: protect_plan_tier_columns() blocked the update';
      else
        raise exception 'CHECK 2 FAILED with unexpected error: %', sqlerrm;
      end if;
  end;

  reset role;
end $$;

-- ============================================================
-- CHECK 3: try_consume_plan_generation() is one-time-only
-- ============================================================
do $$
declare
  v_first boolean;
  v_second boolean;
begin
  select public.try_consume_plan_generation('11111111-1111-1111-1111-111111111111') into v_first;
  select public.try_consume_plan_generation('11111111-1111-1111-1111-111111111111') into v_second;

  if v_first is not true or v_second is not false then
    raise exception 'CHECK 3 FAILED: first=%, second=% (expected true, false)', v_first, v_second;
  end if;

  raise notice 'CHECK 3 PASSED: free plan-generation quota consumed exactly once';
end $$;

-- ============================================================
-- CHECK 4: Class Table Inheritance — non-admins only see published content
-- ============================================================
do $$
declare
  v_visible_count int;
begin
  insert into public.learning_contents (id, type, is_published, created_by)
  values ('33333333-3333-3333-3333-333333333333', 'vocabulary', true, '22222222-2222-2222-2222-222222222222');
  insert into public.vocabulary_items (content_id, target_lang, target_text, native_lang, native_text)
  values ('33333333-3333-3333-3333-333333333333', 'en', 'apple', 'ja', 'りんご');

  insert into public.learning_contents (id, type, is_published, created_by)
  values ('44444444-4444-4444-4444-444444444444', 'vocabulary', false, '22222222-2222-2222-2222-222222222222');
  insert into public.vocabulary_items (content_id, target_lang, target_text, native_lang, native_text)
  values ('44444444-4444-4444-4444-444444444444', 'en', 'draft-word', 'ja', '下書き');

  set local role authenticated;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  select count(*) into v_visible_count from public.vocabulary_items;
  reset role;

  if v_visible_count <> 1 then
    raise exception 'CHECK 4 FAILED: non-admin saw % rows, expected 1 (only the published one)', v_visible_count;
  end if;

  raise notice 'CHECK 4 PASSED: unpublished content is hidden from non-admins by RLS';
end $$;

-- ============================================================
-- CHECK 5: content_groups_owner_shape CHECK constraint
-- ============================================================
do $$
begin
  begin
    insert into public.content_groups (owner_type, owner_id, title, type, created_by)
    values ('system', '22222222-2222-2222-2222-222222222222', 'bad group', 'vocabulary', '22222222-2222-2222-2222-222222222222');
    raise exception 'CHECK 5 FAILED: invalid owner_type/owner_id combination was accepted';
  exception
    when check_violation then
      raise notice 'CHECK 5 PASSED: content_groups_owner_shape rejected the bad row';
  end;
end $$;

-- ============================================================
-- CHECK 6: tags unique (category, name)
-- ============================================================
do $$
begin
  insert into public.tags (id, category, name) values ('77777777-7777-7777-7777-777777777777', 'level', 'beginner');
  begin
    insert into public.tags (category, name) values ('level', 'beginner');
    raise exception 'CHECK 6 FAILED: duplicate (category, name) was accepted';
  exception
    when unique_violation then
      raise notice 'CHECK 6 PASSED: tags unique constraint enforced';
  end;
end $$;

-- ============================================================
-- CHECK 7 (ADR-13): one active learning_plan per (profile, target_lang)
-- ============================================================
do $$
begin
  insert into public.learning_plans (id, profile_id, target_lang, plan_json)
  values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'en', '{"goal": "TOEIC 500"}');

  begin
    insert into public.learning_plans (profile_id, target_lang, plan_json)
    values ('11111111-1111-1111-1111-111111111111', 'en', '{"goal": "duplicate"}');
    raise exception 'CHECK 7 FAILED: a second active plan for the same language was accepted';
  exception
    when unique_violation then
      raise notice 'CHECK 7 PASSED: learning_plans_one_active_per_lang enforced (ADR-13)';
  end;
end $$;

-- ============================================================
-- CHECK 8: plan_day_logs unique (learning_plan_id, log_date)
-- ============================================================
do $$
begin
  insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
  values ('55555555-5555-5555-5555-555555555555', '2026-08-10', 30);

  begin
    insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
    values ('55555555-5555-5555-5555-555555555555', '2026-08-10', 15);
    raise exception 'CHECK 8 FAILED: a second log for the same day was accepted';
  exception
    when unique_violation then
      raise notice 'CHECK 8 PASSED: plan_day_logs one-per-day constraint enforced';
  end;
end $$;

-- ============================================================
-- CHECK 9: test_items rejects a non-existent test_id (FK)
-- ============================================================
do $$
begin
  insert into public.learning_contents (id, type, is_published, created_by)
  values ('88888888-8888-8888-8888-888888888888', 'grammar', true, '22222222-2222-2222-2222-222222222222');
  insert into public.grammar_items (content_id, target_lang, question, choices, answer)
  values ('88888888-8888-8888-8888-888888888888', 'en', 'I ___ a student.', '["am", "is", "are"]', 'am');

  begin
    insert into public.test_items (test_id, content_id, position)
    values ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 1);
    raise exception 'CHECK 9 FAILED: test_items accepted a non-existent test_id';
  exception
    when foreign_key_violation then
      raise notice 'CHECK 9 PASSED: test_items FK constraint enforced';
  end;
end $$;

-- ============================================================
-- CHECK 10: check_test_completion() marks tests completed once all items are answered
-- ============================================================
do $$
declare
  v_status text;
begin
  insert into public.tests (id, profile_id, source_group_ids)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '{}');
  insert into public.test_items (test_id, content_id, position) values
    ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 1),
    ('66666666-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888', 2);

  insert into public.learning_records (profile_id, content_id, test_id, is_correct)
  values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', true);

  select status into v_status from public.tests where id = '66666666-6666-6666-6666-666666666666';
  if v_status <> 'in_progress' then
    raise exception 'CHECK 10 FAILED: status became % after only 1 of 2 items answered', v_status;
  end if;

  insert into public.learning_records (profile_id, content_id, test_id, is_correct)
  values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', false);

  select status into v_status from public.tests where id = '66666666-6666-6666-6666-666666666666';
  if v_status <> 'completed' then
    raise exception 'CHECK 10 FAILED: status is % after all items answered, expected completed', v_status;
  end if;

  raise notice 'CHECK 10 PASSED: check_test_completion() updated tests.status correctly';
end $$;

-- ============================================================
-- CHECK 11: user_vocabulary_progress composite primary key
-- ============================================================
do $$
begin
  insert into public.user_vocabulary_progress (profile_id, content_id, cycle)
  values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 1);

  begin
    insert into public.user_vocabulary_progress (profile_id, content_id, cycle)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 2);
    raise exception 'CHECK 11 FAILED: duplicate (profile_id, content_id) was accepted';
  exception
    when unique_violation then
      raise notice 'CHECK 11 PASSED: user_vocabulary_progress composite PK enforced';
  end;
end $$;

-- ============================================================
-- CHECK 12: ai_usage_logs has no client insert policy (backend-only table)
-- ============================================================
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  begin
    insert into public.ai_usage_logs (profile_id, purpose, provider)
    values ('11111111-1111-1111-1111-111111111111', 'plan_generation', 'claude');
    raise exception 'CHECK 12 FAILED: a regular user was able to insert into ai_usage_logs';
  exception
    when insufficient_privilege then
      raise notice 'CHECK 12 PASSED: ai_usage_logs blocked client insert (RLS)';
  end;

  reset role;
end $$;

-- ============================================================
-- CHECK 13 (regression test for the id-column bug found in review):
-- log_admin_action() must work on tables with no "id" column, e.g. content_tags.
-- ============================================================
do $$
declare
  v_row_id uuid;
  v_action text;
begin
  insert into public.content_tags (content_id, tag_id)
  values ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777');

  set local role authenticated;
  set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
  delete from public.content_tags
  where content_id = '33333333-3333-3333-3333-333333333333' and tag_id = '77777777-7777-7777-7777-777777777777';
  reset role;

  select row_id, action into v_row_id, v_action
  from public.admin_audit_logs
  where table_name = 'content_tags'
  order by created_at desc
  limit 1;

  if v_action is distinct from 'delete' then
    raise exception 'CHECK 13 FAILED: no admin_audit_logs row recorded for content_tags delete';
  end if;

  raise notice 'CHECK 13 PASSED: log_admin_action() handled an id-less table without erroring (row_id=%)', v_row_id;
end $$;

-- ============================================================
-- CHECK 14: increment_actual_minutes() atomically upserts and adds on repeat calls
-- (added for the Expo frontend's auto time-tracking, frontend_design.md §2)
-- ============================================================
do $$
declare
  v_minutes int;
begin
  -- earlier checks left request.jwt.claims pointing at the admin (CHECK 13); reset it to the
  -- plan's actual owner (user1, set up back in CHECK 7) before calling the ownership-checked function
  set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  perform public.increment_actual_minutes('55555555-5555-5555-5555-555555555555', '2026-08-11', 5);
  perform public.increment_actual_minutes('55555555-5555-5555-5555-555555555555', '2026-08-11', 3);

  select actual_minutes into v_minutes
  from public.plan_day_logs
  where learning_plan_id = '55555555-5555-5555-5555-555555555555' and log_date = '2026-08-11';

  if v_minutes <> 8 then
    raise exception 'CHECK 14 FAILED: actual_minutes = % after two calls (5 + 3), expected 8', v_minutes;
  end if;

  begin
    perform public.increment_actual_minutes('99999999-9999-9999-9999-999999999999', '2026-08-11', 5);
    raise exception 'CHECK 14 FAILED: incrementing a learning_plan owned by someone else was accepted';
  exception
    when others then
      if sqlerrm not like '%does not belong to the caller%' then
        raise exception 'CHECK 14 FAILED with unexpected error: %', sqlerrm;
      end if;
  end;

  raise notice 'CHECK 14 PASSED: increment_actual_minutes() adds atomically and enforces ownership';
end $$;

do $$
begin
  raise notice 'ALL 14 BEHAVIOR CHECKS PASSED';
end $$;

rollback;
