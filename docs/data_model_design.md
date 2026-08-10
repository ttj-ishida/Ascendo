# Ascendo データモデル設計(DDL本体)

`db_design_decisions_and_notes.md`(ADR・マイグレーション順序)、`app_project_handoff.md`、`api_design.md`が前提として参照している「テーブル定義本体」。

> **このドキュメントについて**: 元々はclaude.aiとの会話で作成されていたが、本リポジトリには引き継がれず欠落していた(2026-08時点で判明)。本ファイルは、他ドキュメント(ADR、要件定義、API設計、画面遷移)に散らばった言及から**復元・再構築**したものであり、claude.aiとの原会話の一字一句の再現ではない。特に`LearningPlanJSON`のスキーマ(6章)は手がかりからの再構成であり、実装着手時に要見直し。差異や矛盾を見つけた場合は本ファイルを正とせず、要件と突き合わせて修正すること。

> 関連ファイル: `app_project_handoff.md`(全体サマリー)、`db_design_decisions_and_notes.md`(ADR・マイグレーション順序)、`api_design.md`(API設計)

---

## 1. ENUM型

ADR-12により、変更頻度の低い属性のみENUM型とする(それ以外は`text` + `CHECK`制約)。

```sql
create type plan_tier as enum ('free', 'paid');
create type subscription_status as enum ('active', 'canceled', 'expired', 'grace_period');
create type subscription_store as enum ('app_store', 'google_play');
create type content_group_owner_type as enum ('system', 'user');
create type ai_usage_purpose as enum ('plan_generation', 'plan_chat', 'tts_generation');
create type ai_usage_provider as enum ('claude', 'openai');
```

---

## 2. 共通関数・トリガー

### 2-1. `is_admin()` — 管理者判定

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;
```

### 2-2. `set_updated_at()` — `updated_at`自動更新

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

`updated_at`列を持つ全テーブルに`before update`トリガーとして適用する(4章参照)。

### 2-3. `handle_new_user()` — サインアップ時の`profiles`自動作成

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

### 2-4. `protect_plan_tier_columns()` — `profiles`の保護列ガード

`plan_tier`/`paid_until`に加えて、UC-12(ユーザーのステータス変更)に必要な`status`列も同じ保護対象とする(ADR-10の対象列をここで拡張)。

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

create trigger trg_protect_plan_tier_columns
before update on public.profiles
for each row execute function public.protect_plan_tier_columns();
```

### 2-5. `try_consume_plan_generation(uuid)` — AI学習計画生成の無料枠をアトミックに消費

MVPでは生涯1回固定(`requirements_mvp.md` 9-1)。行ロックで競合状態を回避する(`app_project_handoff.md` 5-2の8番)。

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

### 2-6. `log_admin_action()` — 管理者操作の監査ログ自動記録(ADR-14)

```sql
create or replace function public.log_admin_action()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  -- auth.uid()がnull(=通常はservice_role等、ユーザーコンテキストのない接続)の場合は
  -- 「誰が」の記録ができないため監査ログはスキップする。バックエンドは常にユーザー自身の
  -- JWTを転送してSupabaseへアクセスする設計(api_design.mdの前提)のため、通常はnullにならない。
  if v_admin_id is null then
    return coalesce(new, old);
  end if;

  insert into public.admin_audit_logs (admin_id, table_name, row_id, action, before, after)
  values (
    v_admin_id,
    TG_TABLE_NAME,
    -- NEW.id/OLD.idを直接参照すると、id列を持たないテーブル(複合主キーのcontent_tags等、
    -- content_idが主キーのvocabulary_items等)で実行時に「column "id" does not exist」エラーになる。
    -- to_jsonbで安全に取り出し、存在しなければnullにする(その場合もbefore/afterに全カラムが残る)。
    nullif(v_row ->> 'id', '')::uuid,
    lower(TG_OP),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP = 'UPDATE' then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;
```

**適用対象テーブル**(`api_design.md` 6章の未確定事項をここで確定): `learning_contents`, `vocabulary_items`, `grammar_items`, `listening_items`, `shadowing_items`, `listening_passages`, `content_groups`, `content_group_items`, `tags`, `content_tags`, `content_group_tags` の`after update or delete`。`profiles`のみ例外的に、保護列(`plan_tier`/`paid_until`/`status`)が変化した時だけ発火する`when`条件付きトリガーにする(通常のプロフィール編集まで監査ログに残さないため)。具体的なトリガー文は各テーブルのDDL末尾に記載する。

> **見つかったバグの記録**: 当初`coalesce(new.id, old.id)`で行IDを取得する実装にしていたが、`content_tags`/`content_group_tags`(複合主キー、`id`列なし)と`vocabulary_items`/`grammar_items`/`listening_items`/`shadowing_items`(主キーが`content_id`、`id`列なし)に監査トリガーを適用すると、実行時に`column "id" does not exist`で確実に失敗する構成になっていた。Docker/Supabase CLI環境がなく実機検証していないため、目視レビューで発見し上記の通り修正した。他にも未発見の同種バグが残っている可能性がある(7章参照)。

### 2-7. `check_test_completion()` — テスト完了判定(全問回答でstatus自動更新)

`api_design.md` 6章の未着手事項を実装。

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
    return new; -- 通常練習(テスト経由でない解答)は対象外
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

### 2-8. `increment_actual_minutes()` — 学習時間の自動計測(アトミック加算)

`frontend_design.md`で決定した「実績時間は手入力ではなく自動計測」方式のために追加。`try_consume_plan_generation()`(2-5)と同じ「行ロック相当の`insert ... on conflict do update`」パターンで、同時アクセスでも実績時間を正しく積み上げる。

```sql
create or replace function public.increment_actual_minutes(
  p_learning_plan_id uuid, p_log_date date, p_minutes int
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.learning_plans
                  where id = p_learning_plan_id and profile_id = auth.uid()) then
    raise exception 'learning_plan % does not belong to the caller', p_learning_plan_id;
  end if;

  insert into public.plan_day_logs (learning_plan_id, log_date, actual_minutes)
  values (p_learning_plan_id, p_log_date, p_minutes)
  on conflict (learning_plan_id, log_date)
  do update set actual_minutes = plan_day_logs.actual_minutes + excluded.actual_minutes;
end;
$$;
```

呼び出し元(学習画面)は`userClient`経由で直接呼ぶ(バックエンドAPIを経由しない)。`profile_id = auth.uid()`の所有権チェックにより、他人の`learning_plan_id`を指定しても加算されない。

---

## 3. テーブル定義

`db_design_decisions_and_notes.md`「2. マイグレーション実行順序」と同じ依存順で記載する。各テーブルのRLSは要点のみ記す(`USING`/`WITH CHECK`の対象条件を文章で表現)。

### 3-1. `admins`

```sql
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
create policy admins_select on public.admins for select using (public.is_admin());
-- insert/update/deleteポリシーは意図的に定義しない(3-1参照。SQL Editor/service_roleのみ)
```

### 3-2. `profiles`

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
-- insertポリシーなし(handle_new_user()がsecurity definerで作成するため不要)

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_plan_tier_columns();
create trigger trg_profiles_audit
  after update on public.profiles
  for each row
  when (old.plan_tier is distinct from new.plan_tier
        or old.paid_until is distinct from new.paid_until
        or old.status is distinct from new.status)
  execute function public.log_admin_action();
```

### 3-3. `subscriptions`

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
-- insert/update/deleteポリシーなし(3-2参照。バックエンドがservice_roleで書き込む)

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
```

### 3-4. `listening_passages`

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
create policy listening_passages_write on public.listening_passages
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_listening_passages_updated_at
  before update on public.listening_passages
  for each row execute function public.set_updated_at();
create trigger trg_listening_passages_audit
  after update or delete on public.listening_passages
  for each row execute function public.log_admin_action();
```

### 3-5. `learning_contents`(Class Table Inheritance の親、ADR-01)

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
create trigger trg_learning_contents_audit
  after update or delete on public.learning_contents
  for each row execute function public.log_admin_action();
```

### 3-6. 種別詳細テーブル(`vocabulary_items` / `grammar_items` / `listening_items` / `shadowing_items`)

4テーブルとも`content_id`を主キー兼外部キーとする1:1の詳細テーブル(ADR-02: itemの粒度は正誤等を個別記録できる最小単位)。RLSは共通パターンのため`vocabulary_items`のみ全文を示し、他3つは差分だけ記す。

```sql
create table public.vocabulary_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  target_lang text not null,        -- 学習対象言語側(ADR-08)
  target_text text not null,
  target_phonetic text,
  target_usage text,
  native_lang text not null,        -- ユーザー母語側(ADR-08)
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
create trigger trg_vocabulary_items_audit
  after update or delete on public.vocabulary_items
  for each row execute function public.log_admin_action();
```

```sql
create table public.grammar_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  target_lang text not null,
  question text not null,
  choices jsonb not null,     -- 選択肢配列。answerがchoicesに含まれる保証はアプリ側バリデーション(ADR-01の却下理由の裏返し)
  answer text not null,
  explanation text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- RLS/トリガーはvocabulary_itemsと同一パターン(テーブル名のみ置き換え)
```

```sql
create table public.listening_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  listening_passage_id uuid not null references public.listening_passages(id),
  question text not null,
  choices jsonb not null,
  answer text not null,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- RLS/トリガーはvocabulary_itemsと同一パターン
```

```sql
create table public.shadowing_items (
  content_id uuid primary key references public.learning_contents(id) on delete cascade,
  listening_passage_id uuid not null references public.listening_passages(id),
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- RLS/トリガーはvocabulary_itemsと同一パターン
```

### 3-7. `content_groups`(ADR-03, ADR-04)

```sql
create table public.content_groups (
  id uuid primary key default gen_random_uuid(),
  owner_type content_group_owner_type not null default 'system',
  owner_id uuid references public.profiles(id),   -- owner_type='user'のときのみ非null
  title text not null,
  type text not null check (type in ('vocabulary', 'grammar', 'listening', 'shadowing', 'mixed')),
  is_published boolean not null default false,
  created_by uuid references public.admins(id),     -- owner_type='system'のときのみ非null
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
create trigger trg_content_groups_audit
  after update or delete on public.content_groups
  for each row execute function public.log_admin_action();
```

### 3-8. `content_group_items`

```sql
create table public.content_group_items (
  id uuid primary key default gen_random_uuid(),
  content_group_id uuid not null references public.content_groups(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now()
  -- 既知の未対応事項: (content_group_id, position) の一意制約なし(db_design_decisions_and_notes.md 3-3)
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

create trigger trg_content_group_items_audit
  after update or delete on public.content_group_items
  for each row execute function public.log_admin_action();
```

### 3-9. `tags` / `content_tags` / `content_group_tags`(ADR-11)

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  category text not null,   -- 列挙型にせず自由入力(ADR-11)
  name text not null,
  created_at timestamptz not null default now(),
  unique (category, name)
);

alter table public.tags enable row level security;
create policy tags_select on public.tags for select using (true); -- 認証済み全ユーザーが閲覧可(絞り込みUIに必要)
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
-- RLSはcontent_tagsと同一パターン(content_groupsのis_published/owner判定に置き換え)

create trigger trg_tags_audit after update or delete on public.tags
  for each row execute function public.log_admin_action();
create trigger trg_content_tags_audit after update or delete on public.content_tags
  for each row execute function public.log_admin_action();
create trigger trg_content_group_tags_audit after update or delete on public.content_group_tags
  for each row execute function public.log_admin_action();
```

### 3-10. `learning_plans`(ADR-13で`target_lang`を追加)

```sql
create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_lang text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  plan_json jsonb not null,   -- スキーマは6章 LearningPlanJSON 参照
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ADR-13: 同一ユーザー・同一言語でactiveな計画は1件まで
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

### 3-11. `plan_day_logs` / `plan_week_logs`(ADR-06)

```sql
create table public.plan_day_logs (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references public.learning_plans(id) on delete cascade,
  log_date date not null,
  actual_minutes int not null default 0,
  tasks_done jsonb not null default '{}'::jsonb,  -- 週次タスクIDごとの実施チェック
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
  plan_hours numeric not null,   -- 実績は plan_day_logs からSUMで算出(ADR-06)
  reflection_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_plan_id, week_start_date)
);
-- RLS/トリガーはplan_day_logsと同一パターン
```

### 3-12. `tests` / `test_items`(ADR-07)

```sql
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_group_ids uuid[] not null,   -- content_groups.id の配列(FK制約なし。ADR-05と同趣旨)
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- 既知の未対応事項: deleteポリシーなし(db_design_decisions_and_notes.md 3-3)
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
  -- 既知の未対応事項: (test_id, position) の一意制約なし(db_design_decisions_and_notes.md 3-3)
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

### 3-13. `learning_records`(ADR-07)

```sql
create table public.learning_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id),
  test_id uuid references public.tests(id),   -- null = 通常練習、非null = テスト経由の解答
  is_correct boolean not null,
  duration_seconds numeric,
  answered_at timestamptz not null default now()
);

alter table public.learning_records enable row level security;
create policy learning_records_select on public.learning_records
  for select using (profile_id = auth.uid() or public.is_admin());
create policy learning_records_insert on public.learning_records
  for insert with check (profile_id = auth.uid());
-- update/deleteポリシーなし(解答イベントログとしてイミュータブルに扱う)
```

### 3-14. `user_vocabulary_progress`(ADR-09)

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

### 3-15. `ai_usage_logs`

```sql
create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  learning_plan_id uuid references public.learning_plans(id),
  listening_passage_id uuid references public.listening_passages(id),
  purpose ai_usage_purpose not null,
  provider ai_usage_provider not null,
  estimated_cost_usd numeric(10, 6),  -- 精度: 小数点以下6桁(db_design_decisions_and_notes.md 3-3の未確定事項をここで確定)
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs enable row level security;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select using (public.is_admin());
-- insert/update/deleteポリシーなし(3-2参照。バックエンドがservice_roleで書き込む)
```

### 3-16. `admin_audit_logs`

```sql
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id),
  table_name text not null,
  row_id uuid,  -- id列を持たないテーブル(複合主キー等)ではnull。全カラムはbefore/afterに残る
  action text not null check (action in ('update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
create policy admin_audit_logs_select on public.admin_audit_logs
  for select using (public.is_admin());
-- insert/update/deleteポリシーなし(log_admin_action()がsecurity definerで書き込む。3-2参照)
```

---

## 4. `updated_at`自動更新トリガーの適用対象

`set_updated_at()`(2-2)を`before update`で適用するテーブル: `profiles`, `subscriptions`, `listening_passages`, `learning_contents`, `vocabulary_items`, `grammar_items`, `listening_items`, `shadowing_items`, `content_groups`, `learning_plans`, `plan_day_logs`, `plan_week_logs`, `tests`, `user_vocabulary_progress`。

(`learning_records`, `ai_usage_logs`, `admin_audit_logs`は追記のみのイベントログのため対象外。`content_group_items`, `tags`, `content_tags`, `content_group_tags`, `test_items`は更新より削除→再作成が基本运用のため対象外)

---

## 5. インデックス

主キー・外部キー以外に追加するインデックス。

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

(`learning_plans_one_active_per_lang`は3-10に記載済みの部分ユニークインデックス)

---

## 6. `LearningPlanJSON`スキーマ(`learning_plans.plan_json`)

`app_project_handoff.md`が言及する「フェーズ/週次タスク/月次タスク/マイルストーン」構造を、`english_roadmap.html`の既存構造(`project_handoff.md`の2章)を参考に再構成したもの。AIには既存の`content_groups`一覧をコンテキストとして渡し、`contentGroupIds`に実在するIDを埋め込ませる(ADR-05: コンテンツ自体は生成させない)。

```ts
interface LearningPlanJSON {
  goal: string;                     // ユーザーが入力した目標(資格試験・面接対策等)
  currentLevel: string;             // 現在のレベル(自己申告)
  weeklyAvailableHours: number;     // 週あたり学習可能時間
  phases: LearningPhase[];
  contentGroupIds: string[];        // 参照する content_groups.id (DB制約でなくアプリ側バリデーション。ADR-05)
  conversationLog?: ChatMessage[];  // AIとの対話ログ(任意。requirements_mvp.md 7章)
}

interface LearningPhase {
  id: string;
  name: string;                     // 例: "Phase 1 基礎固め"
  startDate: string;                // ISO8601 date
  endDate: string;
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
  milestones: Milestone[];
}

interface WeeklyTask {
  id: string;
  label: string;
  contentGroupId?: string;          // 対応するcontent_groupsがあれば紐付け
}

interface MonthlyTask {
  id: string;
  label: string;
  month: string;                    // "2026-09" 形式
}

interface Milestone {
  id: string;
  label: string;
  targetValue: string;
  actualValue?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

`plan_day_logs.tasks_done`(jsonb)は`WeeklyTask.id`をキーとした真偽値マップを想定する(例: `{"grammar-mon": true, "vocab-tue": false}`)。

---

## 7. このドキュメントの限界

- 冒頭の注記の通り、原会話の再現ではなく復元。特にJSON構造(6章)・列の細部(型の精度、NOT NULL制約の厳密さ)は実装着手時に見直すこと
- 実際のSupabaseマイグレーションファイル化は未実施。適用順序は`db_design_decisions_and_notes.md`「2. マイグレーション実行順序」を参照(本ファイルの2章・3章がそこで言う関数・テーブルの実体)
- RLSポリシーはSQL草案であり、Supabase実機での動作確認(特に`content_group_items`等のネストしたEXISTSサブクエリのパフォーマンス)は未検証
