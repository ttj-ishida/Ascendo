create table public.learning_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id),
  test_id uuid references public.tests(id),
  is_correct boolean not null,
  duration_seconds numeric,
  answered_at timestamptz not null default now()
);

alter table public.learning_records enable row level security;
create policy learning_records_select on public.learning_records
  for select using (profile_id = auth.uid() or public.is_admin());
create policy learning_records_insert on public.learning_records
  for insert with check (profile_id = auth.uid());
