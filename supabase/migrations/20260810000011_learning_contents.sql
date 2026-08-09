create table public.learning_contents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('vocabulary', 'grammar', 'listening', 'shadowing')),
  difficulty int not null default 1 check (difficulty between 1 and 5),
  is_published boolean not null default false,
  created_by uuid not null references public.admins(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learning_contents enable row level security;
create policy learning_contents_select on public.learning_contents
  for select using (is_published or public.is_admin());
create policy learning_contents_write on public.learning_contents
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_learning_contents_updated_at
  before update on public.learning_contents
  for each row execute function public.set_updated_at();
