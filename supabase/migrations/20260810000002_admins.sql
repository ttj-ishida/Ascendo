create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
