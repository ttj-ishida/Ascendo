create or replace function public.protect_plan_tier_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.plan_tier is distinct from old.plan_tier
      or new.paid_until is distinct from old.paid_until
      or new.status is distinct from old.status)
     and not public.is_admin()
     and auth.role() <> 'service_role' then
    raise exception 'plan_tier, paid_until, and status can only be changed by an admin or backend service';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_plan_tier_columns();
