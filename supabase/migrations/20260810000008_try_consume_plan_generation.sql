create or replace function public.try_consume_plan_generation(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  select plan_generation_count into v_count
  from public.profiles
  where id = p_user_id
  for update;

  if v_count is null then
    raise exception 'profile not found: %', p_user_id;
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
