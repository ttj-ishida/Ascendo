create table public.vocabulary_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  target_lang text not null,
  target_text text not null,
  target_phonetic text,
  target_usage text,
  native_lang text not null,
  native_text text not null,
  native_phonetic text,
  native_usage text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.vocabulary_items enable row level security;
create policy vocabulary_items_select on public.vocabulary_items
  for select using (
    exists (select 1 from public.learning_contents lc
            where lc.id = content_id and (lc.is_published or public.is_admin()))
  );
create policy vocabulary_items_write on public.vocabulary_items
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_vocabulary_items_updated_at
  before update on public.vocabulary_items
  for each row execute function public.set_updated_at();

create table public.grammar_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  target_lang text not null,
  question text not null,
  choices jsonb not null,
  answer text not null,
  explanation text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.grammar_items enable row level security;
create policy grammar_items_select on public.grammar_items
  for select using (
    exists (select 1 from public.learning_contents lc
            where lc.id = content_id and (lc.is_published or public.is_admin()))
  );
create policy grammar_items_write on public.grammar_items
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_grammar_items_updated_at
  before update on public.grammar_items
  for each row execute function public.set_updated_at();

create table public.listening_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  listening_passage_id uuid not null references public.listening_passages(id),
  question text not null,
  choices jsonb not null,
  answer text not null,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.listening_items enable row level security;
create policy listening_items_select on public.listening_items
  for select using (
    exists (select 1 from public.learning_contents lc
            where lc.id = content_id and (lc.is_published or public.is_admin()))
  );
create policy listening_items_write on public.listening_items
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_listening_items_updated_at
  before update on public.listening_items
  for each row execute function public.set_updated_at();

create table public.shadowing_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  listening_passage_id uuid not null references public.listening_passages(id),
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shadowing_items enable row level security;
create policy shadowing_items_select on public.shadowing_items
  for select using (
    exists (select 1 from public.learning_contents lc
            where lc.id = content_id and (lc.is_published or public.is_admin()))
  );
create policy shadowing_items_write on public.shadowing_items
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_shadowing_items_updated_at
  before update on public.shadowing_items
  for each row execute function public.set_updated_at();

-- listening_passagesの閲覧可否は、それを参照する公開済みコンテンツがあるかどうかで決まる
-- (listening_items/shadowing_itemsが作成された後でないと定義できないため、ここで追加する)
create policy listening_passages_select on public.listening_passages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.listening_items li
        join public.learning_contents lc on lc.id = li.content_id
      where li.listening_passage_id = listening_passages.id and lc.is_published
      union
      select 1 from public.shadowing_items si
        join public.learning_contents lc on lc.id = si.content_id
      where si.listening_passage_id = listening_passages.id and lc.is_published
    )
  );
