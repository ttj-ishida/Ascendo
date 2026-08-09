create table public.tags (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category, name)
);

alter table public.tags enable row level security;
create policy tags_select on public.tags for select using (true);
create policy tags_write on public.tags for all using (public.is_admin()) with check (public.is_admin());

create table public.content_tags (
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (content_id, tag_id)
);

alter table public.content_tags enable row level security;
create policy content_tags_select on public.content_tags
  for select using (
    exists (select 1 from public.learning_contents lc where lc.id = content_id
            and (lc.is_published or public.is_admin()))
  );
create policy content_tags_write on public.content_tags
  for all using (public.is_admin()) with check (public.is_admin());

create table public.content_group_tags (
  content_group_id uuid not null references public.content_groups(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (content_group_id, tag_id)
);

alter table public.content_group_tags enable row level security;
create policy content_group_tags_select on public.content_group_tags
  for select using (
    exists (select 1 from public.content_groups cg where cg.id = content_group_id
            and (public.is_admin()
                 or (cg.owner_type = 'system' and cg.is_published)
                 or (cg.owner_type = 'user' and cg.owner_id = auth.uid())))
  );
create policy content_group_tags_write on public.content_group_tags
  for all using (public.is_admin()) with check (public.is_admin());
