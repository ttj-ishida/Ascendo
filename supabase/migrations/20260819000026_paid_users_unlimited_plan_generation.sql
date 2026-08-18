-- Paid subscribers get unlimited plan generation for the duration of their subscription;
-- plan_generation_count only governs the free tier's one-time lifetime allowance. Previously
-- try_consume_plan_generation() ignored profiles.plan_tier/paid_until entirely, so even a paying
-- user was capped at the same single free generation.
create or replace function public.try_consume_plan_generation(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
  v_plan_tier plan_tier;
  v_paid_until timestamptz;
begin
  select plan_generation_count, plan_tier, paid_until
    into v_count, v_plan_tier, v_paid_until
  from public.profiles
  where id = p_user_id
  for update;

  if v_count is null then
    raise exception 'profile not found: %', p_user_id;
  end if;

  if v_plan_tier = 'paid' and v_paid_until is not null and v_paid_until > now() then
    return true;
  end if;

  if v_count >= 1 then
    return false;
  end if;

  update public.profiles
  set plan_generation_count = plan_generation_count + 1
  where id = p_user_id;

  return true;
end;
$$;
