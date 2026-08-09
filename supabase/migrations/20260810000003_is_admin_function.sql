create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create policy admins_select on public.admins for select using (public.is_admin());
-- insert/update/deleteポリシーは意図的に定義しない(SQL Editor/service_roleのみ。data_model_design.md 3-1参照)
