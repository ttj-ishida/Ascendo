create or replace function public.log_admin_action()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if v_admin_id is null then
    return coalesce(new, old);
  end if;

  insert into public.admin_audit_logs (admin_id, table_name, row_id, action, before, after)
  values (
    v_admin_id,
    TG_TABLE_NAME,
    nullif(v_row ->> 'id', '')::uuid,
    lower(TG_OP),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP = 'UPDATE' then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_learning_contents_audit
  after update or delete on public.learning_contents
  for each row execute function public.log_admin_action();
create trigger trg_vocabulary_items_audit
  after update or delete on public.vocabulary_items
  for each row execute function public.log_admin_action();
create trigger trg_grammar_items_audit
  after update or delete on public.grammar_items
  for each row execute function public.log_admin_action();
create trigger trg_listening_items_audit
  after update or delete on public.listening_items
  for each row execute function public.log_admin_action();
create trigger trg_shadowing_items_audit
  after update or delete on public.shadowing_items
  for each row execute function public.log_admin_action();
create trigger trg_listening_passages_audit
  after update or delete on public.listening_passages
  for each row execute function public.log_admin_action();
create trigger trg_content_groups_audit
  after update or delete on public.content_groups
  for each row execute function public.log_admin_action();
create trigger trg_content_group_items_audit
  after update or delete on public.content_group_items
  for each row execute function public.log_admin_action();
create trigger trg_tags_audit
  after update or delete on public.tags
  for each row execute function public.log_admin_action();
create trigger trg_content_tags_audit
  after update or delete on public.content_tags
  for each row execute function public.log_admin_action();
create trigger trg_content_group_tags_audit
  after update or delete on public.content_group_tags
  for each row execute function public.log_admin_action();

create trigger trg_profiles_audit
  after update on public.profiles
  for each row
  when (old.plan_tier is distinct from new.plan_tier
        or old.paid_until is distinct from new.paid_until
        or old.status is distinct from new.status)
  execute function public.log_admin_action();
