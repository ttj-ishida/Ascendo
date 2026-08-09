create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_lang text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index learning_plans_one_active_per_lang
  on public.learning_plans (profile_id, target_lang)
  where status = 'active';

alter table public.learning_plans enable row level security;
create policy learning_plans_select on public.learning_plans
  for select using (profile_id = auth.uid() or public.is_admin());
create policy learning_plans_insert on public.learning_plans
  for insert with check (profile_id = auth.uid());
create policy learning_plans_update on public.learning_plans
  for update using (profile_id = auth.uid() or public.is_admin());

create trigger trg_learning_plans_updated_at
  before update on public.learning_plans
  for each row execute function public.set_updated_at();
