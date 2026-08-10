# Ascendo Expoフロントエンド設計

エンドユーザー向けExpoモバイルアプリ(MVP 11画面)の設計。管理者向け画面(5画面)は完全に別のWebアプリとして切り離し、別途あらためて設計する(本ドキュメントの対象外)。

> 関連ファイル: `requirements_supplementary.md`(5章、画面一覧)、`screen_flow.md`(画面遷移)、`api_design.md`(バックエンド5エンドポイント)、`auth_design.md`(認証フロー)、`data_model_design.md`(DBスキーマ)

---

## 1. スコープ・前提

- 対象は`requirements_supplementary.md`5章の「エンドユーザー向け」11画面(#1〜11)。管理者向け(#14〜18)は対象外
- Phase2/3機能(#12 スピーキング、#13 課金画面)は対象外
- デザインの方向性: **スタディサプリ(スタサプ)を参考にした、丸みを帯びたカードUI**。テーマカラーは**薄いグリーン**基調
- `plan_day_logs.actual_minutes`(実績時間)は**自動計測方式**とする(english_roadmap.htmlの手入力方式とは異なる、本設計での決定事項)。この決定に伴い、DBに新規関数`increment_actual_minutes`が必要(2章参照)

---

## 2. DB追加要件: `increment_actual_minutes`関数

自動時間計測を安全に実現するため、既存の`try_consume_plan_generation`と同じ「行ロック+アトミック更新」パターンで新規関数を追加する。**`data_model_design.md`・`db_migrations_plan.md`は本設計の対象外だが、フロントエンド実装前にこの関数のマイグレーションを追加する必要がある**(未実施、今後の作業)。

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

学習画面(単語/文法/リスニング)は画面フォーカス中の経過時間をこの関数でSupabaseに直接加算する(バックエンドAPIを経由しない、`api_design.md`のハイブリッド方針通り)。

---

## 3. 技術スタック

| 領域 | 選定 | 理由 |
|---|---|---|
| ルーティング | Expo Router(ファイルベース) | 認証ガード・PlanCheckをレイアウトファイルで自然に表現できる |
| サーバー状態管理 | TanStack Query + `supabase-js` | ハイブリッド方針(直接Supabase読み書き)と相性が良い定番パターン |
| クライアント状態 | React Context(`AuthContext`のみ) | セッション情報のみのため最小限で十分 |
| スタイリング | React Native標準`StyleSheet` | 追加依存なし |
| フォームバリデーション | `zod` | メール形式・パスワード強度チェック |
| 音声再生 | `expo-av` | リスニング画面の音源再生 |
| セッション永続化 | `expo-secure-store` | Keychain/Keystoreへの安全な保存(`auth_design.md`の方針) |
| ディープリンク | `expo-linking` | メール確認・パスワードリセットのリンク処理 |
| テスト | Jest + `jest-expo` + `@testing-library/react-native` | Expo公式標準。RNコンポーネントテストには`node:test`ではなくJSX/DOM相当の環境が必要 |

---

## 4. デザインシステム

- **配色**: Primary(薄いグリーン、例 `#6FCF97`)、Primary背景(ごく薄いグリーン、例 `#F2FAF6`)、本文テキスト(ダークグレー、例 `#2D3748`)、背景(白)
- **コンポーネントスタイル**: 角丸カード(radius 12〜16px)、影は控えめ、ボタンは角丸のPrimary塗りつぶし
- **進捗表現**: プログレスバー/リングで視覚化(スタサプに倣う)
- **トーン**: フレンドリーで圧迫感のない配色・余白

---

## 5. ルート構成(Expo Router)

```
app/
  _layout.tsx                    ルート: SafeAreaProvider, QueryClientProvider, AuthProvider
  (auth)/
    _layout.tsx                  未ログイン用スタック。セッションありなら(app)へリダイレクト
    onboarding.tsx                初回起動のみ
    signup-or-login.tsx           「新規登録」/「ログイン」選択
    sign-up.tsx
    sign-up-confirm.tsx           確認メール待機(ディープリンクで自動遷移)
    log-in.tsx
    forgot-password.tsx
    reset-password.tsx            ディープリンク到達、新パスワード入力
  (app)/
    _layout.tsx                   認証ガード: セッションなし→(auth)へ。学習計画なし→plan-creation
    plan-creation.tsx             AIチャットで学習計画作成
    upgrade-info.tsx
    (tabs)/
      _layout.tsx                 ボトムタブ
      index.tsx                   ホーム(ダッシュボード)
      vocab.tsx
      grammar.tsx
      listening.tsx
      records.tsx
      settings.tsx
```

---

## 6. 認証まわり(#1〜3, 10の一部)

### 決定事項
- **メール確認必須**: サインアップ後、確認メールのリンクをクリックするまでログイン不可
- **パスワードリセット機能を含む**(`requirements_mvp.md`6.1の未決定事項をここで確定)

### 画面詳細

| 画面 | 内容 |
|---|---|
| onboarding | アプリ紹介。「はじめる」→ signup-or-login。初回起動判定は`expo-secure-store`のフラグで管理 |
| signup-or-login | 「新規登録」/「ログイン」ボタンのみのシンプルな選択画面 |
| sign-up | メール・パスワード・確認用パスワード。`supabase.auth.signUp()`→成功でsign-up-confirmへ |
| sign-up-confirm | 「確認メールを送信しました」。ディープリンク(`ascendo://`)でメール内リンクを受け取り、`supabase-js`が自動でセッション確立→(app)へ遷移 |
| log-in | メール・パスワード。`supabase.auth.signInWithPassword()` |
| forgot-password | メール入力→`supabase.auth.resetPasswordForEmail(email, { redirectTo: 'ascendo://reset-password' })` |
| reset-password | ディープリンク到達(回復セッション自動確立済み)。新パスワード入力→`supabase.auth.updateUser({ password })` |

### 認証ガード(`app/(app)/_layout.tsx`)

1. `AuthContext`のセッション状態を確認。なければ`(auth)`へリダイレクト
2. セッションありなら`learning_plans`(status='active')の有無を確認。なければ`plan-creation`へ、あれば`(tabs)`へ

---

## 7. ホーム/ダッシュボード画面(#5)

english_roadmap.htmlの構成を踏襲しつつ、実績部分は自動計測に合わせて閲覧専用に変更する。

```
┌ ヘッダー
│  目標までのカウントダウン、全体進捗%、累計時間(予定/実績・自動計測)
├ 今日/今週やることカード(最上部、クイックアクセス)
├ フェーズ別アコーディオン(Phase 1/2/3、LearningPlanJSON.phasesから描画)
│  ├ 週次タスク一覧(参照リスト、WeeklyTask[])
│  ├ 月次タスク(チェックボックス、MonthlyTask[])
│  └ マイルストーン(目標値/実績値、Milestone[])
└ 週次実績サマリー(plan_day_logsの自動集計、閲覧専用)
```

データ取得: 直接Supabase。`learning_plans`(active)の`plan_json`をパースしてフェーズ表示、`plan_day_logs`/`plan_week_logs`の集計はPostgres ViewまたはRPC経由。

---

## 8. 学習計画作成(AIチャット)画面(#4)

- チャットUI(吹き出し形式)。`POST /api/v1/plans/chat`を1ターンずつ呼び、`readyToGenerate: true`になったら「学習計画を作成する」ボタン表示
- ボタン押下で`POST /api/v1/plans`(`target_lang`は固定で`"en"`、MVPは英語のみ)
- `403 FREE_QUOTA_EXHAUSTED`時はその場でupgrade-infoへ誘導
- `409 ACTIVE_PLAN_EXISTS`時は既存の計画をそのまま使う(通常到達しないはずだが念のためホームへリダイレクト)

---

## 9. 学習画面群(#6〜8)

### 単語(Vocab)

- ライトナー式間隔反復。`user_vocabulary_progress.cycle`の低い単語を優先出題
- カード形式(表: `target_text`、裏: `native_text`+発音)。正解でcycle+1、不正解でcycle=0にリセット(直接Supabase update)
- 画面フォーカス中、一定間隔(例: 30秒ごと)または画面離脱時に`increment_actual_minutes`を呼ぶ

### 文法(Grammar)

- `content_groups`(type=grammar)から出題、選択式(`grammar_items.choices`)
- 解答ごとに`learning_records`へinsert(直接Supabase)
- 同様に滞在時間を計測

### リスニング(Listening)

- `listening_items` + `listening_passages.audio_url`を`expo-av`で再生、設問に解答
- `audio_url`が未生成(null)の場合は「準備中」表示に留める(TTS生成は管理者操作、エンドユーザー画面からは呼ばない)

### テスト機能(共通)

- 各学習画面から「テストする」導線 → `POST /api/v1/assessments`で出題セット生成
- 解答は`learning_records`へ直接insert(`test_id`付き)。全問回答で`tests.status`はDBトリガー(`check_test_completion`)が自動更新、バックエンド関与不要

---

## 10. 実績画面(#9)

- 正答率・学習時間の推移をグラフ表示
- データは`learning_records`/`plan_day_logs`の集計クエリ(直接Supabase)

---

## 11. 設定画面(#10)

- アカウント情報表示、ログアウト(`supabase.auth.signOut()`)
- 退会: 確認ダイアログ→`DELETE /api/v1/identity/me`(`confirmation: "DELETE"`をボディに含める)

---

## 12. アップグレード案内画面(#11)

- 無料枠上限到達時に表示。Phase2機能の紹介のみ、MVPでは購入導線なし

---

## 13. 今後の検討事項

- `increment_actual_minutes`のマイグレーション追加(2章、DB側の未実施作業)
- Home画面のフェーズ表示は`LearningPlanJSON`の`phases: unknown[]`を実際にパースする必要があり、バックエンドの`types.ts`同様、フロントエンドでも`LearningPhase`/`WeeklyTask`/`MonthlyTask`/`Milestone`の具体的な型定義が必要(`data_model_design.md`6章の型を移植)
- 単語学習の出題優先度アルゴリズム(cycle順以外の要素、例えば`forgotten_at`からの経過日数を使うか)は未確定
- オフライン対応は`requirements_supplementary.md`の前提条件により非対応(常時インターネット接続前提)
- プッシュ通知(学習リマインド等)はMVPスコープ外、要件定義に記載なし
