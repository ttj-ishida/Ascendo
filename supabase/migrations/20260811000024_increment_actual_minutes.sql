create or replace function public.increment_actual_minutes(
  p_learning_plan_id uuid, p_log_date date, p_minutes int
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.learning_plans
                  where id = p_learning_plan_id and profile_id = auth.uid()) then
    raise exception 'learning_plan % does not belong to the caller', p_learning_plan_id;
  end if;

  insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
  values (p_learning_plan_id, p_log_date, p_minutes)
  on conflict (learning_plan_id, log_date)
  do update set actual_minutes = plan_day_logs.actual_minutes + excluded.actual_minutes;
end;
$$;
