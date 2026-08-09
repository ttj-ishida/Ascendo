# Ascendo Supabase DBマイグレーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/ascendo/docs/data_model_design.md`のDDL(23テーブル・6 ENUM・7関数)を、Supabase CLIで実際に適用可能なマイグレーションファイル群として`apps/ascendo/supabase/migrations/`に落とし込み、ローカルSupabaseスタック上で動作検証する。

**Architecture:** `db_design_decisions_and_notes.md`「2. マイグレーション実行順序」(27ステップ)を、依存関係を壊さない範囲で16タスクにグルーピング。各タスクは1〜数個のマイグレーションファイルを追加し、`supabase db reset`で全マイグレーションを再適用してから、そのタスクで追加したテーブル/関数/ポリシーが期待通り動くことをSQLで確認する。

**Tech Stack:** Supabase CLI, Docker Desktop(ローカルPostgres実行用), PostgreSQL(Supabaseが内部で使うバージョン), psql

## Global Constraints

- DDLの内容は`apps/ascendo/docs/data_model_design.md`を正とする(本計画のSQLは同ファイルからの転記。差異が必要になった場合はdata_model_design.md側も更新すること)
- マイグレーション適用順序は`apps/ascendo/docs/db_design_decisions_and_notes.md`「2. マイグレーション実行順序」の1〜27ステップの依存関係を守ること
- 全テーブルで`alter table ... enable row level security;`を必須とする(RLS未設定のテーブルを残さない)
- マイグレーションファイル名は`YYYYMMDDHHMMSS_<説明>.sql`(Supabase CLIの規約)。本計画では`20260810000001`から連番で採番する
- 各タスックのテスト手順は`supabase db reset`(全マイグレーション再適用)→ 検証SQL、を基本パターンとする。**このタスクの実行にはDocker DesktopとSupabase CLIのインストールが前提**(Task 1で確認する)

---

### Task 1: 環境確認とSupabaseプロジェクトの初期化

**Files:**
- Create: `apps/ascendo/supabase/config.toml`(`supabase init`で生成)
- Create: `apps/ascendo/package.json`

**Interfaces:**
- Produces: `apps/ascendo/`配下で実行する`npm run db:reset`(= `supabase db reset`のラッパー)、`npm run db:start`(= `supabase start`)。以降の全タスクがこの2コマンドを使う

- [ ] **Step 1: Docker DesktopとSupabase CLIが使えることを確認する**

Run: `docker --version && supabase --version`
Expected: 両方ともバージョン文字列が表示される。表示されない場合は、[Docker Desktop](https://www.docker.com/products/docker-desktop/)と[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)を先にインストールする(このステップはコード変更を伴わない前提条件確認)

- [ ] **Step 2: `apps/ascendo/`でSupabaseプロジェクトを初期化する**

Run:
```bash
cd apps/ascendo
supabase init
```
Expected: `apps/ascendo/supabase/config.toml`と`apps/ascendo/supabase/migrations/`(空ディレクトリ)が作成される

- [ ] **Step 3: ローカルSupabaseスタックを起動できることを確認する**

Run: `supabase start`
Expected: コマンドが完了し、`API URL`・`DB URL`・`anon key`・`service_role key`を含む出力が表示される。`DB URL`は通常`postgresql://postgres:postgres@127.0.0.1:54322/postgres`

- [ ] **Step 4: `apps/ascendo/package.json`を作成する**

```json
{
  "name": "ascendo-db",
  "private": true,
  "version": "1.0.0",
  "description": "Supabase migrations and local dev workflow for the Ascendo backend.",
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/ascendo/supabase/config.toml apps/ascendo/package.json
git commit -m "chore(ascendo): init Supabase project scaffolding"
```

---

### Task 2: ENUM型 + `admins` + `is_admin()`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000001_enums.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000002_admins.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000003_is_admin_function.sql`

**Interfaces:**
- Produces: ENUM型`plan_tier`/`subscription_status`/`subscription_store`/`content_group_owner_type`/`ai_usage_purpose`/`ai_usage_provider`、テーブル`public.admins`、関数`public.is_admin() returns boolean`(以降の全タスクで管理者判定に使用)

- [ ] **Step 1: 検証SQLを書く(まだ存在しないことを確認する)**

`apps/ascendo/supabase/migrations/`は空の状態で以下を実行し、失敗することを確認する:

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select 'admins'::regclass;"
```
Expected: FAIL — `relation "admins" does not exist`

- [ ] **Step 2: ENUM型のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000001_enums.sql`:
```sql
create type plan_tier as enum ('free', 'paid');
create type subscription_status as enum ('active', 'canceled', 'expired', 'grace_period');
create type subscription_store as enum ('app_store', 'google_play');
create type content_group_owner_type as enum ('system', 'user');
create type ai_usage_purpose as enum ('plan_generation', 'plan_chat', 'tts_generation');
create type ai_usage_provider as enum ('claude', 'openai');
```

- [ ] **Step 3: `admins`テーブルのマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000002_admins.sql`:
```sql
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
```

- [ ] **Step 4: `is_admin()`関数のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000003_is_admin_function.sql`:
```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create policy admins_select on public.admins for select using (public.is_admin());
-- insert/update/deleteポリシーは意図的に定義しない(SQL Editor/service_roleのみ。data_model_design.md 3-1参照)
```

- [ ] **Step 5: 適用して検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select 'public.admins'::regclass; select proname from pg_proc where proname = 'is_admin';"
```
Expected: PASS — `admins`テーブルと`is_admin`関数が両方とも存在する

- [ ] **Step 6: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000001_enums.sql \
        apps/ascendo/supabase/migrations/20260810000002_admins.sql \
        apps/ascendo/supabase/migrations/20260810000003_is_admin_function.sql
git commit -m "feat(ascendo-db): add enums, admins table, is_admin()"
```

---

### Task 3: `profiles` + `handle_new_user()` + `set_updated_at()` + `protect_plan_tier_columns()`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000004_set_updated_at_function.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000005_profiles.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000006_handle_new_user.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000007_protect_plan_tier_columns.sql`

**Interfaces:**
- Consumes: `public.is_admin()`(Task 2)
- Produces: テーブル`public.profiles`(列: `id`, `display_name`, `status`, `plan_tier`, `paid_until`, `plan_generation_count`, `created_at`, `updated_at`)、関数`public.set_updated_at()`(以降の全`updated_at`列持ちテーブルで使用)、トリガーによるサインアップ時の`profiles`自動作成と保護列ガード

- [ ] **Step 1: `set_updated_at()`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000004_set_updated_at_function.sql`:
```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

- [ ] **Step 2: `profiles`テーブルのマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000005_profiles.sql`:
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan_tier plan_tier not null default 'free',
  paid_until timestamptz,
  plan_generation_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: `handle_new_user()`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000006_handle_new_user.sql`:
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

- [ ] **Step 4: `protect_plan_tier_columns()`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000007_protect_plan_tier_columns.sql`:
```sql
create or replace function public.protect_plan_tier_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.plan_tier is distinct from old.plan_tier
      or new.paid_until is distinct from old.paid_until
      or new.status is distinct from old.status)
     and not public.is_admin()
     and auth.role() <> 'service_role' then
    raise exception 'plan_tier, paid_until, and status can only be changed by an admin or backend service';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_plan_tier_columns();
```

- [ ] **Step 5: 適用し、サインアップで`profiles`が自動作成されることを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
select id, status, plan_tier, plan_generation_count from public.profiles where id = '11111111-1111-1111-1111-111111111111';
SQL
```
Expected: PASS — 1行返り、`status = active`, `plan_tier = free`, `plan_generation_count = 0`

- [ ] **Step 6: 保護列ガードが非管理者からの直接更新を拒否することを検証する**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.profiles set plan_tier = 'paid' where id = '11111111-1111-1111-1111-111111111111';
SQL
```
Expected: FAIL — `plan_tier, paid_until, and status can only be changed by an admin or backend service`

- [ ] **Step 7: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000004_set_updated_at_function.sql \
        apps/ascendo/supabase/migrations/20260810000005_profiles.sql \
        apps/ascendo/supabase/migrations/20260810000006_handle_new_user.sql \
        apps/ascendo/supabase/migrations/20260810000007_protect_plan_tier_columns.sql
git commit -m "feat(ascendo-db): add profiles, auto-provisioning, protected-column guard"
```

---

### Task 4: `try_consume_plan_generation()` + `subscriptions`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000008_try_consume_plan_generation.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000009_subscriptions.sql`

**Interfaces:**
- Consumes: `public.profiles`(Task 3)
- Produces: 関数`public.try_consume_plan_generation(p_user_id uuid) returns boolean`、テーブル`public.subscriptions`

- [ ] **Step 1: `try_consume_plan_generation()`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000008_try_consume_plan_generation.sql`:
```sql
create or replace function public.try_consume_plan_generation(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  select plan_generation_count into v_count
  from public.profiles
  where id = p_user_id
  for update;

  if v_count is null then
    raise exception 'profile not found: %', p_user_id;
  end if;

  if v_count >= 1 then
    return false;
  end if;

  update public.profiles
  set plan_generation_count = plan_generation_count + 1
  where id = p_user_id;

  return true;
end;
$$;
```

- [ ] **Step 2: `subscriptions`テーブルのマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000009_subscriptions.sql`:
```sql
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
```

- [ ] **Step 3: 1回目は成功・2回目は失敗することを検証する(生涯1回の無料枠)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
select public.try_consume_plan_generation('11111111-1111-1111-1111-111111111111') as first_call;
select public.try_consume_plan_generation('11111111-1111-1111-1111-111111111111') as second_call;
SQL
```
Expected: PASS — `first_call = t`, `second_call = f`

- [ ] **Step 4: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000008_try_consume_plan_generation.sql \
        apps/ascendo/supabase/migrations/20260810000009_subscriptions.sql
git commit -m "feat(ascendo-db): add free-quota consumption function and subscriptions"
```

---

### Task 5: `listening_passages` + `learning_contents` + 4種別詳細テーブル

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000010_listening_passages.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000011_learning_contents.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000012_content_detail_tables.sql`

**Interfaces:**
- Consumes: `public.admins`(Task 2), `public.is_admin()`(Task 2), `public.set_updated_at()`(Task 3)
- Produces: テーブル`public.listening_passages`, `public.learning_contents`, `public.vocabulary_items`, `public.grammar_items`, `public.listening_items`, `public.shadowing_items`(いずれも`content_id`ではなく`listening_passages`/`learning_contents`は`id`が主キー、4種別詳細テーブルは`content_id`が主キー)

- [ ] **Step 1: `listening_passages`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000010_listening_passages.sql`(RLSは学習コンテンツテーブル作成後に有効化する必要があるため、このファイルではテーブル定義とトリガーのみとし、`listening_passages_select`ポリシーはStep 3で`learning_contents`と一緒に追加する):
```sql
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
```

- [ ] **Step 2: `learning_contents`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000011_learning_contents.sql`:
```sql
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
```

- [ ] **Step 3: 4種別詳細テーブル + `listening_passages_select`ポリシーのマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000012_content_detail_tables.sql`:
```sql
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
```

- [ ] **Step 4: Class Table Inheritanceが機能することを検証する(公開コンテンツのみ閲覧可)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');

insert into public.learning_contents (id, type, is_published, created_by)
values ('33333333-3333-3333-3333-333333333333', 'vocabulary', true, '22222222-2222-2222-2222-222222222222');
insert into public.vocabulary_items (content_id, target_lang, target_text, native_lang, native_text)
values ('33333333-3333-3333-3333-333333333333', 'en', 'apple', 'ja', 'りんご');

insert into public.learning_contents (id, type, is_published, created_by)
values ('44444444-4444-4444-4444-444444444444', 'vocabulary', false, '22222222-2222-2222-2222-222222222222');
insert into public.vocabulary_items (content_id, target_lang, target_text, native_lang, native_text)
values ('44444444-4444-4444-4444-444444444444', 'en', 'draft-word', 'ja', '下書き');

set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';
select target_text from public.vocabulary_items;
SQL
```
Expected: PASS — 結果は`apple`の1行のみ(`draft-word`は`is_published = false`のため非管理者からは見えない)

- [ ] **Step 5: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000010_listening_passages.sql \
        apps/ascendo/supabase/migrations/20260810000011_learning_contents.sql \
        apps/ascendo/supabase/migrations/20260810000012_content_detail_tables.sql
git commit -m "feat(ascendo-db): add learning_contents CTI hierarchy and listening_passages"
```

---

### Task 6: `content_groups` + `content_group_items`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000013_content_groups.sql`

**Interfaces:**
- Consumes: `public.admins`, `public.profiles`, `public.learning_contents`, `public.is_admin()`, `public.set_updated_at()`
- Produces: テーブル`public.content_groups`, `public.content_group_items`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000013_content_groups.sql`:
```sql
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
```

- [ ] **Step 2: `content_groups_owner_shape`制約が不正な組み合わせを拒否することを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');
-- owner_type='system'なのにowner_idが入っている(不正)
insert into public.content_groups (owner_type, owner_id, title, type, created_by)
values ('system', '22222222-2222-2222-2222-222222222222', 'bad group', 'vocabulary', '22222222-2222-2222-2222-222222222222');
SQL
```
Expected: FAIL — `new row for relation "content_groups" violates check constraint "content_groups_owner_shape"`

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000013_content_groups.sql
git commit -m "feat(ascendo-db): add content_groups and content_group_items"
```

---

### Task 7: `tags` + `content_tags` + `content_group_tags`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000014_tags.sql`

**Interfaces:**
- Consumes: `public.learning_contents`, `public.content_groups`, `public.is_admin()`
- Produces: テーブル`public.tags`, `public.content_tags`, `public.content_group_tags`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000014_tags.sql`:
```sql
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
```

- [ ] **Step 2: `tags`の`unique (category, name)`制約を検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into public.tags (category, name) values ('part_of_speech', 'noun');
insert into public.tags (category, name) values ('part_of_speech', 'noun');
SQL
```
Expected: FAIL — `duplicate key value violates unique constraint "tags_category_name_key"`

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000014_tags.sql
git commit -m "feat(ascendo-db): add tags, content_tags, content_group_tags"
```

---

### Task 8: `learning_plans`(ADR-13の言語別ユニーク制約を含む)

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000015_learning_plans.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.set_updated_at()`
- Produces: テーブル`public.learning_plans`、部分ユニークインデックス`learning_plans_one_active_per_lang`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000015_learning_plans.sql`:
```sql
create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_lang text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index learning_plans_one_active_per_lang
  on public.learning_plans (profile_id, target_lang)
  where status = 'active';

alter table public.learning_plans enable row level security;
create policy learning_plans_select on public.learning_plans
  for select using (profile_id = auth.uid() or public.is_admin());
create policy learning_plans_insert on public.learning_plans
  for insert with check (profile_id = auth.uid());
create policy learning_plans_update on public.learning_plans
  for update using (profile_id = auth.uid() or public.is_admin());

create trigger trg_learning_plans_updated_at
  before update on public.learning_plans
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: 同一言語で2件目のactiveな計画が作れないことを検証する(ADR-13)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
insert into public.learning_plans (profile_id, target_lang, plan_json)
values ('11111111-1111-1111-1111-111111111111', 'en', '{"goal": "TOEIC 500"}');
insert into public.learning_plans (profile_id, target_lang, plan_json)
values ('11111111-1111-1111-1111-111111111111', 'en', '{"goal": "duplicate"}');
SQL
```
Expected: FAIL — `duplicate key value violates unique constraint "learning_plans_one_active_per_lang"`

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000015_learning_plans.sql
git commit -m "feat(ascendo-db): add learning_plans with one-active-plan-per-language constraint"
```

---

### Task 9: `plan_day_logs` + `plan_week_logs`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000016_plan_logs.sql`

**Interfaces:**
- Consumes: `public.learning_plans`, `public.is_admin()`, `public.set_updated_at()`
- Produces: テーブル`public.plan_day_logs`, `public.plan_week_logs`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000016_plan_logs.sql`:
```sql
create table public.plan_day_logs (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references public.learning_plans(id) on delete cascade,
  log_date date not null,
  actual_minutes int not null default 0,
  tasks_done jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_plan_id, log_date)
);

alter table public.plan_day_logs enable row level security;
create policy plan_day_logs_all on public.plan_day_logs
  for all using (
    public.is_admin()
    or exists (select 1 from public.learning_plans lp
               where lp.id = learning_plan_id and lp.profile_id = auth.uid())
  );

create trigger trg_plan_day_logs_updated_at
  before update on public.plan_day_logs
  for each row execute function public.set_updated_at();

create table public.plan_week_logs (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references public.learning_plans(id) on delete cascade,
  week_start_date date not null,
  plan_hours numeric not null,
  reflection_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_plan_id, week_start_date)
);

alter table public.plan_week_logs enable row level security;
create policy plan_week_logs_all on public.plan_week_logs
  for all using (
    public.is_admin()
    or exists (select 1 from public.learning_plans lp
               where lp.id = learning_plan_id and lp.profile_id = auth.uid())
  );

create trigger trg_plan_week_logs_updated_at
  before update on public.plan_week_logs
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: 同じ日に2件の日次ログが作れないことを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
insert into public.learning_plans (id, profile_id, target_lang, plan_json)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'en', '{}');
insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
values ('55555555-5555-5555-5555-555555555555', '2026-08-10', 30);
insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
values ('55555555-5555-5555-5555-555555555555', '2026-08-10', 15);
SQL
```
Expected: FAIL — `duplicate key value violates unique constraint "plan_day_logs_learning_plan_id_log_date_key"`

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000016_plan_logs.sql
git commit -m "feat(ascendo-db): add plan_day_logs and plan_week_logs"
```

---

### Task 10: `tests` + `test_items`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000017_tests.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.learning_contents`, `public.is_admin()`, `public.set_updated_at()`
- Produces: テーブル`public.tests`, `public.test_items`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000017_tests.sql`:
```sql
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_group_ids uuid[] not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tests enable row level security;
create policy tests_select on public.tests
  for select using (profile_id = auth.uid() or public.is_admin());
create policy tests_insert on public.tests
  for insert with check (profile_id = auth.uid());
create policy tests_update on public.tests
  for update using (profile_id = auth.uid() or public.is_admin());

create trigger trg_tests_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();

create table public.test_items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id),
  position int not null,
  created_at timestamptz not null default now()
);

alter table public.test_items enable row level security;
create policy test_items_select on public.test_items
  for select using (
    exists (select 1 from public.tests t where t.id = test_id
            and (t.profile_id = auth.uid() or public.is_admin()))
  );
create policy test_items_insert on public.test_items
  for insert with check (
    exists (select 1 from public.tests t where t.id = test_id and t.profile_id = auth.uid())
  );
```

- [ ] **Step 2: `test_items`が存在しない`test_id`を拒否することを検証する(FK制約)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');
insert into public.learning_contents (id, type, is_published, created_by)
values ('33333333-3333-3333-3333-333333333333', 'grammar', true, '22222222-2222-2222-2222-222222222222');
insert into public.test_items (test_id, content_id, position)
values ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 1);
SQL
```
Expected: FAIL — `insert or update on table "test_items" violates foreign key constraint` (存在しない`tests.id`を参照)

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000017_tests.sql
git commit -m "feat(ascendo-db): add tests and test_items"
```

---

### Task 11: `learning_records` + `check_test_completion()`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000018_learning_records.sql`
- Create: `apps/ascendo/supabase/migrations/20260810000019_check_test_completion.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.learning_contents`, `public.tests`, `public.test_items`
- Produces: テーブル`public.learning_records`、関数`public.check_test_completion()`(`tests.status`を全問回答で`completed`に自動更新)

- [ ] **Step 1: `learning_records`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000018_learning_records.sql`:
```sql
create table public.learning_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id),
  test_id uuid references public.tests(id),
  is_correct boolean not null,
  duration_seconds numeric,
  answered_at timestamptz not null default now()
);

alter table public.learning_records enable row level security;
create policy learning_records_select on public.learning_records
  for select using (profile_id = auth.uid() or public.is_admin());
create policy learning_records_insert on public.learning_records
  for insert with check (profile_id = auth.uid());
```

- [ ] **Step 2: `check_test_completion()`のマイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000019_check_test_completion.sql`:
```sql
create or replace function public.check_test_completion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_test_id uuid := new.test_id;
  v_total int;
  v_answered int;
begin
  if v_test_id is null then
    return new;
  end if;

  select count(*) into v_total from public.test_items where test_id = v_test_id;
  select count(distinct content_id) into v_answered
    from public.learning_records
    where test_id = v_test_id;

  if v_total > 0 and v_answered >= v_total then
    update public.tests set status = 'completed'
    where id = v_test_id and status <> 'completed';
  end if;

  return new;
end;
$$;

create trigger trg_check_test_completion
after insert on public.learning_records
for each row execute function public.check_test_completion();
```

- [ ] **Step 3: 全問回答で`tests.status`が`completed`になることを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');

insert into public.learning_contents (id, type, is_published, created_by)
values ('33333333-3333-3333-3333-333333333333', 'grammar', true, '22222222-2222-2222-2222-222222222222');
insert into public.learning_contents (id, type, is_published, created_by)
values ('44444444-4444-4444-4444-444444444444', 'grammar', true, '22222222-2222-2222-2222-222222222222');

insert into public.tests (id, profile_id, source_group_ids)
values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '{}');
insert into public.test_items (test_id, content_id, position) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 1),
  ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 2);

insert into public.learning_records (profile_id, content_id, test_id, is_correct)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', true);
select status from public.tests where id = '66666666-6666-6666-6666-666666666666';

insert into public.learning_records (profile_id, content_id, test_id, is_correct)
values ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', false);
select status from public.tests where id = '66666666-6666-6666-6666-666666666666';
SQL
```
Expected: PASS — 1回目の`select status`は`in_progress`、2問目回答後の`select status`は`completed`

- [ ] **Step 4: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000018_learning_records.sql \
        apps/ascendo/supabase/migrations/20260810000019_check_test_completion.sql
git commit -m "feat(ascendo-db): add learning_records and test-completion trigger"
```

---

### Task 12: `user_vocabulary_progress`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000020_user_vocabulary_progress.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.learning_contents`, `public.is_admin()`, `public.set_updated_at()`
- Produces: テーブル`public.user_vocabulary_progress`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000020_user_vocabulary_progress.sql`:
```sql
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
```

- [ ] **Step 2: 複合主キーが重複を防ぐことを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');
insert into public.learning_contents (id, type, is_published, created_by)
values ('33333333-3333-3333-3333-333333333333', 'vocabulary', true, '22222222-2222-2222-2222-222222222222');

insert into public.user_vocabulary_progress (profile_id, content_id, cycle)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 1);
insert into public.user_vocabulary_progress (profile_id, content_id, cycle)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 2);
SQL
```
Expected: FAIL — `duplicate key value violates unique constraint "user_vocabulary_progress_pkey"`

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000020_user_vocabulary_progress.sql
git commit -m "feat(ascendo-db): add user_vocabulary_progress"
```

---

### Task 13: `ai_usage_logs` + `admin_audit_logs`

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000021_ai_usage_and_audit_logs.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.learning_plans`, `public.listening_passages`, `public.admins`, `public.is_admin()`
- Produces: テーブル`public.ai_usage_logs`, `public.admin_audit_logs`

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000021_ai_usage_and_audit_logs.sql`:
```sql
create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  learning_plan_id uuid references public.learning_plans(id),
  listening_passage_id uuid references public.listening_passages(id),
  purpose ai_usage_purpose not null,
  provider ai_usage_provider not null,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs enable row level security;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select using (public.is_admin());

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
create policy admin_audit_logs_select on public.admin_audit_logs
  for select using (public.is_admin());
```

- [ ] **Step 2: 非管理者からのinsertがRLSで拒否されることを検証する(バックエンド専用テーブル)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.ai_usage_logs (profile_id, purpose, provider) values ('11111111-1111-1111-1111-111111111111', 'plan_generation', 'claude');
SQL
```
Expected: FAIL — `new row violates row-level security policy for table "ai_usage_logs"`(insertポリシーが存在しないため)

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000021_ai_usage_and_audit_logs.sql
git commit -m "feat(ascendo-db): add ai_usage_logs and admin_audit_logs"
```

---

### Task 14: `log_admin_action()` + 監査トリガー適用(ADR-14)

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000022_log_admin_action.sql`

**Interfaces:**
- Consumes: `public.admin_audit_logs`(Task 13)、監査対象の全テーブル(Task 3, 5, 6, 7)
- Produces: 関数`public.log_admin_action()`、対象11テーブルへの監査トリガー

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000022_log_admin_action.sql`:
```sql
create or replace function public.log_admin_action()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if v_admin_id is null then
    return coalesce(new, old);
  end if;

  insert into public.admin_audit_logs (admin_id, table_name, row_id, action, before, after)
  values (
    v_admin_id,
    TG_TABLE_NAME,
    nullif(v_row ->> 'id', '')::uuid,
    lower(TG_OP),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP = 'UPDATE' then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_learning_contents_audit
  after update or delete on public.learning_contents
  for each row execute function public.log_admin_action();
create trigger trg_vocabulary_items_audit
  after update or delete on public.vocabulary_items
  for each row execute function public.log_admin_action();
create trigger trg_grammar_items_audit
  after update or delete on public.grammar_items
  for each row execute function public.log_admin_action();
create trigger trg_listening_items_audit
  after update or delete on public.listening_items
  for each row execute function public.log_admin_action();
create trigger trg_shadowing_items_audit
  after update or delete on public.shadowing_items
  for each row execute function public.log_admin_action();
create trigger trg_listening_passages_audit
  after update or delete on public.listening_passages
  for each row execute function public.log_admin_action();
create trigger trg_content_groups_audit
  after update or delete on public.content_groups
  for each row execute function public.log_admin_action();
create trigger trg_content_group_items_audit
  after update or delete on public.content_group_items
  for each row execute function public.log_admin_action();
create trigger trg_tags_audit
  after update or delete on public.tags
  for each row execute function public.log_admin_action();
create trigger trg_content_tags_audit
  after update or delete on public.content_tags
  for each row execute function public.log_admin_action();
create trigger trg_content_group_tags_audit
  after update or delete on public.content_group_tags
  for each row execute function public.log_admin_action();

create trigger trg_profiles_audit
  after update on public.profiles
  for each row
  when (old.plan_tier is distinct from new.plan_tier
        or old.paid_until is distinct from new.paid_until
        or old.status is distinct from new.status)
  execute function public.log_admin_action();
```

- [ ] **Step 2: `id`列を持たないテーブル(`content_tags`)への更新が監査ログに記録され、かつ`row_id`がnullで、しかしエラーにならないことを検証する(Task開始前に見つけたバグの回帰テスト)**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'admin@example.com');
insert into public.admins (id) values ('22222222-2222-2222-2222-222222222222');
insert into public.learning_contents (id, type, is_published, created_by)
values ('33333333-3333-3333-3333-333333333333', 'vocabulary', true, '22222222-2222-2222-2222-222222222222');
insert into public.tags (id, category, name) values ('77777777-7777-7777-7777-777777777777', 'level', 'beginner');
insert into public.content_tags (content_id, tag_id)
values ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777');

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
delete from public.content_tags where content_id = '33333333-3333-3333-3333-333333333333';

reset role;
select table_name, row_id, action from public.admin_audit_logs where table_name = 'content_tags';
SQL
```
Expected: PASS — DELETEがエラーなく成功し、`admin_audit_logs`に`table_name = content_tags`, `row_id = null`, `action = delete`の1行が記録される

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000022_log_admin_action.sql
git commit -m "feat(ascendo-db): add log_admin_action() and apply audit triggers (ADR-14)"
```

---

### Task 15: インデックス

**Files:**
- Create: `apps/ascendo/supabase/migrations/20260810000023_indexes.sql`

**Interfaces:**
- Consumes: 全テーブル(Task 2〜13)

- [ ] **Step 1: マイグレーションを書く**

`apps/ascendo/supabase/migrations/20260810000023_indexes.sql`:
```sql
create index idx_learning_contents_type_published on public.learning_contents (type, is_published);
create index idx_content_group_items_group on public.content_group_items (content_group_id);
create index idx_content_group_items_content on public.content_group_items (content_id);
create index idx_learning_records_profile_content on public.learning_records (profile_id, content_id);
create index idx_learning_records_test on public.learning_records (test_id) where test_id is not null;
create index idx_plan_day_logs_plan_date on public.plan_day_logs (learning_plan_id, log_date);
create index idx_user_vocabulary_progress_profile on public.user_vocabulary_progress (profile_id);
create index idx_ai_usage_logs_created_at on public.ai_usage_logs (created_at);
create index idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at);
```

- [ ] **Step 2: 全インデックスが作成されたことを検証する**

Run:
```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\
select indexname from pg_indexes where schemaname = 'public' and indexname like 'idx_%' order by indexname;"
```
Expected: PASS — 9件のインデックス名が全て表示される

- [ ] **Step 3: Commit**

```bash
git add apps/ascendo/supabase/migrations/20260810000023_indexes.sql
git commit -m "feat(ascendo-db): add supporting indexes"
```

---

### Task 16: フルスモークテスト(全マイグレーションの通し検証)

**Files:**
- Create: `apps/ascendo/supabase/tests/smoke_test.sql`
- Modify: `apps/ascendo/package.json`

**Interfaces:**
- Consumes: 全マイグレーション(Task 1〜15)

- [ ] **Step 1: 通しスモークテストSQLを書く**

`apps/ascendo/supabase/tests/smoke_test.sql`(23テーブル全ての存在確認 + RLS有効化確認をワンショットで行う):
```sql
-- 23テーブル全てが存在することを確認
do $$
declare
  v_expected text[] := array[
    'admins', 'profiles', 'subscriptions', 'listening_passages', 'learning_contents',
    'vocabulary_items', 'grammar_items', 'listening_items', 'shadowing_items',
    'content_groups', 'content_group_items', 'tags', 'content_tags', 'content_group_tags',
    'learning_plans', 'plan_day_logs', 'plan_week_logs', 'tests', 'test_items',
    'learning_records', 'user_vocabulary_progress', 'ai_usage_logs', 'admin_audit_logs'
  ];
  v_table text;
  v_missing text[] := '{}';
begin
  foreach v_table in array v_expected loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, v_table);
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception 'missing tables: %', v_missing;
  end if;

  raise notice 'all 23 tables present';
end $$;

-- 全テーブルでRLSが有効化されていることを確認
do $$
declare
  v_disabled text[];
begin
  select array_agg(relname) into v_disabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_disabled is not null then
    raise exception 'RLS not enabled on: %', v_disabled;
  end if;

  raise notice 'RLS enabled on all public tables';
end $$;
```

- [ ] **Step 2: `apps/ascendo/package.json`に`db:smoke-test`スクリプトを追加する**

`apps/ascendo/package.json`(Task 1で作成したものにスクリプトを1行追加):
```json
{
  "name": "ascendo-db",
  "private": true,
  "version": "1.0.0",
  "description": "Supabase migrations and local dev workflow for the Ascendo backend.",
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:smoke-test": "psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" -f supabase/tests/smoke_test.sql"
  }
}
```

- [ ] **Step 3: 通しで実行し、Task 1〜15の全マイグレーションが最初から最後まで問題なく適用されることを確認する**

Run:
```bash
cd apps/ascendo
npm run db:reset
npm run db:smoke-test
```
Expected: PASS — `db:reset`が23個のマイグレーションファイル全てをエラーなく適用し、`db:smoke-test`が`NOTICE: all 23 tables present`と`NOTICE: RLS enabled on all public tables`を出力する

- [ ] **Step 4: Commit**

```bash
git add apps/ascendo/supabase/tests/smoke_test.sql apps/ascendo/package.json
git commit -m "test(ascendo-db): add full-schema smoke test"
```

---

## 完了後の状態

`apps/ascendo/supabase/migrations/`に23個のマイグレーションファイルが揃い、`npm run db:reset && npm run db:smoke-test`でスキーマ全体(23テーブル・6 ENUM・7関数・全RLSポリシー・全トリガー・全インデックス)が検証済みの状態になる。次のサブシステム(`api_design.md`のNode.jsバックエンド5エンドポイント)はこのマイグレーション適用済みのローカルSupabaseスタックを前提に実装できる。
