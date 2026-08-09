-- 23テーブル全てが存在することを確認
do $$
declare
  v_expected text[] := array[
    'admins', 'profiles', 'subscriptions', 'listening_passages', 'learning_contents',
    'vocabulary_items', 'grammar_items', 'listening_items', 'shadowing_items',
    'content_groups', 'content_group_items', 'tags', 'content_tags', 'content_group_tags',
    'learning_plans', 'plan_day_logs', 'plan_week_logs', 'tests', 'test_items',
    'learning_records', 'user_vocabulary_progress', 'ai_usage_logs', 'admin_audit_logs'
  ];
  v_table text;
  v_missing text[] := '{}';
begin
  foreach v_table in array v_expected loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, v_table);
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception 'missing tables: %', v_missing;
  end if;

  raise notice 'all 23 tables present';
end $$;

-- 全テーブルでRLSが有効化されていることを確認
do $$
declare
  v_disabled text[];
begin
  select array_agg(relname) into v_disabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_disabled is not null then
    raise exception 'RLS not enabled on: %', v_disabled;
  end if;

  raise notice 'RLS enabled on all public tables';
end $$;
