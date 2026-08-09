create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  store subscription_store not null,
  status subscription_status not null,
  product_id text not null,
  purchased_at timestamptz not null,
  expires_at timestamptz,
  raw_receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions
  for select using (profile_id = auth.uid() or public.is_admin());

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
