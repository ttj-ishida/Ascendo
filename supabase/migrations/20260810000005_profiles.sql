create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan_tier plan_tier not null default 'free',
  paid_until timestamptz,
  plan_generation_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
