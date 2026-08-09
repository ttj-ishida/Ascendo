create table public.user_vocabulary_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  cycle int not null default 0,
  memorized_at timestamptz,
  forgotten_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, content_id)
);

alter table public.user_vocabulary_progress enable row level security;
create policy user_vocabulary_progress_all on public.user_vocabulary_progress
  for all using (profile_id = auth.uid() or public.is_admin());

create trigger trg_user_vocabulary_progress_updated_at
  before update on public.user_vocabulary_progress
  for each row execute function public.set_updated_at();
