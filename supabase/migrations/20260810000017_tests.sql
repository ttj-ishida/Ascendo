create table public.tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_group_ids uuid[] not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tests enable row level security;
create policy tests_select on public.tests
  for select using (profile_id = auth.uid() or public.is_admin());
create policy tests_insert on public.tests
  for insert with check (profile_id = auth.uid());
create policy tests_update on public.tests
  for update using (profile_id = auth.uid() or public.is_admin());

create trigger trg_tests_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();

create table public.test_items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id),
  position int not null,
  created_at timestamptz not null default now()
);

alter table public.test_items enable row level security;
create policy test_items_select on public.test_items
  for select using (
    exists (select 1 from public.tests t where t.id = test_id
            and (t.profile_id = auth.uid() or public.is_admin()))
  );
create policy test_items_insert on public.test_items
  for insert with check (
    exists (select 1 from public.tests t where t.id = test_id and t.profile_id = auth.uid())
  );
