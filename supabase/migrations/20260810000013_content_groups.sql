create table public.content_groups (
  id uuid primary key default gen_random_uuid(),
  owner_type content_group_owner_type not null default 'system',
  owner_id uuid references public.profiles(id),
  title text not null,
  type text not null check (type in ('vocabulary', 'grammar', 'listening', 'shadowing', 'mixed')),
  is_published boolean not null default false,
  created_by uuid references public.admins(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_groups_owner_shape check (
    (owner_type = 'system' and owner_id is null and created_by is not null) or
    (owner_type = 'user' and owner_id is not null)
  )
);

alter table public.content_groups enable row level security;
create policy content_groups_select on public.content_groups
  for select using (
    public.is_admin()
    or (owner_type = 'system' and is_published)
    or (owner_type = 'user' and owner_id = auth.uid())
  );
create policy content_groups_write_system on public.content_groups
  for all using (owner_type = 'system' and public.is_admin())
  with check (owner_type = 'system' and public.is_admin());
create policy content_groups_write_user on public.content_groups
  for all using (owner_type = 'user' and owner_id = auth.uid())
  with check (owner_type = 'user' and owner_id = auth.uid());

create trigger trg_content_groups_updated_at
  before update on public.content_groups
  for each row execute function public.set_updated_at();

create table public.content_group_items (
  id uuid primary key default gen_random_uuid(),
  content_group_id uuid not null references public.content_groups(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now()
);

alter table public.content_group_items enable row level security;
create policy content_group_items_select on public.content_group_items
  for select using (
    exists (select 1 from public.content_groups cg where cg.id = content_group_id
            and (public.is_admin()
                 or (cg.owner_type = 'system' and cg.is_published)
                 or (cg.owner_type = 'user' and cg.owner_id = auth.uid())))
  );
create policy content_group_items_write on public.content_group_items
  for all using (
    exists (select 1 from public.content_groups cg where cg.id = content_group_id
            and (public.is_admin() or (cg.owner_type = 'user' and cg.owner_id = auth.uid())))
  );
