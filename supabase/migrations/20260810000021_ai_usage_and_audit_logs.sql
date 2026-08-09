create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  learning_plan_id uuid references public.learning_plans(id),
  listening_passage_id uuid references public.listening_passages(id),
  purpose ai_usage_purpose not null,
  provider ai_usage_provider not null,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs enable row level security;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select using (public.is_admin());

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
create policy admin_audit_logs_select on public.admin_audit_logs
  for select using (public.is_admin());
