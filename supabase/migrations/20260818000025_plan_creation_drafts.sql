-- In-progress plan-creation chat conversations, persisted server-side so a user can resume the
-- same draft across Web and mobile (previously held only in the client's local storage, which
-- meant switching device/browser lost the conversation — see app_project_handoff.md).
create table public.plan_creation_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_lang text not null,
  messages jsonb not null default '[]'::jsonb,
  ready_to_generate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One in-progress draft per user per target language, mirroring learning_plans' one-active-
-- plan-per-language rule (ADR-13). The backend upserts against this key on every chat turn.
create unique index plan_creation_drafts_one_per_lang
  on public.plan_creation_drafts (profile_id, target_lang);

alter table public.plan_creation_drafts enable row level security;

create policy plan_creation_drafts_select on public.plan_creation_drafts
  for select using (profile_id = auth.uid());
create policy plan_creation_drafts_insert on public.plan_creation_drafts
  for insert with check (profile_id = auth.uid());
create policy plan_creation_drafts_update on public.plan_creation_drafts
  for update using (profile_id = auth.uid());
create policy plan_creation_drafts_delete on public.plan_creation_drafts
  for delete using (profile_id = auth.uid());

create trigger trg_plan_creation_drafts_updated_at
  before update on public.plan_creation_drafts
  for each row execute function public.set_updated_at();
