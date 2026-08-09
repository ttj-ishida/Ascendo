create table public.plan_day_logs (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references public.learning_plans(id) on delete cascade,
  log_date date not null,
  actual_minutes int not null default 0,
  tasks_done jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_plan_id, log_date)
);

alter table public.plan_day_logs enable row level security;
create policy plan_day_logs_all on public.plan_day_logs
  for all using (
    public.is_admin()
    or exists (select 1 from public.learning_plans lp
               where lp.id = learning_plan_id and lp.profile_id = auth.uid())
  );

create trigger trg_plan_day_logs_updated_at
  before update on public.plan_day_logs
  for each row execute function public.set_updated_at();

create table public.plan_week_logs (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references public.learning_plans(id) on delete cascade,
  week_start_date date not null,
  plan_hours numeric not null,
  reflection_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_plan_id, week_start_date)
);

alter table public.plan_week_logs enable row level security;
create policy plan_week_logs_all on public.plan_week_logs
  for all using (
    public.is_admin()
    or exists (select 1 from public.learning_plans lp
               where lp.id = learning_plan_id and lp.profile_id = auth.uid())
  );

create trigger trg_plan_week_logs_updated_at
  before update on public.plan_week_logs
  for each row execute function public.set_updated_at();
