create table public.listening_passages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.admins(id),
  target_lang text not null,
  script_text text not null,
  audio_url text,
  voice text,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listening_passages enable row level security;
create policy listening_passages_write on public.listening_passages
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_listening_passages_updated_at
  before update on public.listening_passages
  for each row execute function public.set_updated_at();
