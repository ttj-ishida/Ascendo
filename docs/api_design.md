# 学習アプリ API設計

`requirements_mvp.md`・`db_design_decisions_and_notes.md`を踏まえた、MVPのAPIアーキテクチャ設計。ドメイン駆動設計(DDD)の考え方でドメイン境界を切り、モジュラーモノリスとして実装する前提。

> 関連ファイル: `app_project_handoff.md`(全体サマリー)、`requirements_mvp.md`(MVP要件)、`db_design_decisions_and_notes.md`(DB設計ADR、本設計で前提にしているADR-13/ADR-14を含む)

---

## 1. アーキテクチャ概要

### モジュラーモノリス構成

- デプロイ単位は単一のNode.js + TypeScriptサービス(`requirements_mvp.md`の技術スタック決定を維持)
- コード構成はドメインごとにフォルダ分離。各ドメインは自分のDBテーブルにのみ直接アクセスし、他ドメインへは**公開インターフェース(サービス関数)経由のみ**でアクセスする(直接他ドメインのテーブルを触らない)
- ドメイン間呼び出しはプロセス内関数呼び出し。将来的に本当のマイクロサービス化する場合、この境界がそのままサービス分割線になる
- 共有カーネル(Shared Kernel、特定ドメインの状態を持たない横断コンポーネント):
  - `shared/ai-adapter` — Claude API / OpenAI API / OpenAI TTSの抽象化層
  - `shared/auth` — Supabase JWT検証ミドルウェア、`req.user`付与
  - `shared/supabase-client` — Supabase接続(anonキー/service_roleキー使い分け)

### CRUDの経路方針(ハイブリッド)

単純なCRUD(コンテンツ閲覧、学習実績記録、管理者によるコンテンツ/ユーザー管理など)は**ExpoクライアントからSupabaseへ直接アクセス+RLSで保護**する。Node.jsバックエンドは以下に限定して実装する:

1. **AI呼び出しを伴う処理**(APIキーをクライアントに置けないため必須): 学習計画のAI対話・生成、リスニング音源のTTS生成
2. **複数レコードにまたがる組み立てロジック**: テストインスタンスの出題ロジック
3. **service_role権限が必須の処理**: 退会(`auth.users`削除)

管理者操作の監査ログ(`admin_audit_logs`)はDBトリガーで自動記録する(ADR-14)ため、管理者操作自体はバックエンドを経由させる理由にならない。この方針により、バックエンドの実装量はエンドポイント5本程度まで縮小される(詳細は4章)。

---

## 2. API共通規約

| 項目 | 方針 |
|---|---|
| ベースパス | `/api/v1` |
| ドメイン別パス | `/api/v1/identity`, `/api/v1/content`, `/api/v1/plans`, `/api/v1/progress`, `/api/v1/assessments`, `/api/v1/admin` |
| 認証 | `Authorization: Bearer <Supabase JWTアクセストークン>`。共有ミドルウェア(`shared/auth`)で検証し`req.user`にセット。管理者向け処理が必要な場合は追加で管理者ガードを通す |
| エラー形式 | `{ "error": { "code": string, "message": string, "details"?: object } }`。HTTPステータスは400/401/403/404/409/422/500を規約通りに使用 |
| 一覧レスポンス | `{ "items": [...], "pagination": { "cursor" \| "page", "hasMore" } }` |
| バージョニング | URLパス方式(`/v1`)のみ。MVP規模ではヘッダーバージョニング等は不要と判断 |

---

## 3. ドメインモジュール

### ドメイン一覧とDBテーブル対応

| ドメイン | 所有テーブル | 主な責務 |
|---|---|---|
| **Identity & Account** | `profiles`, `subscriptions` | ユーザープロフィール、有料属性(`plan_tier`/`paid_until`)、AI生成無料枠の消費判定(`try_consume_plan_generation`) |
| **Content Catalog** | `learning_contents`, `vocabulary_items`, `grammar_items`, `listening_items`, `shadowing_items`, `listening_passages`, `content_groups`, `content_group_items`, `tags`, `content_tags`, `content_group_tags` | 学習コンテンツのCRUD、コンテンツグループ編成、タグ付け、リスニング音源(TTS生成の呼び出し元) |
| **Learning Plan** | `learning_plans`(`target_lang`列で言語ごとに分離。ADR-13) | AIとの対話による学習計画生成・更新 |
| **Learning Progress** | `plan_day_logs`, `plan_week_logs`, `learning_records`, `user_vocabulary_progress` | 日次/週次の実績記録、コンテンツ解答イベント、単語の習熟状態(Phase2の忘却曲線の土台) |
| **Assessment** | `tests`, `test_items` | テストの構成管理・出題(結果自体は`learning_records`に書く=Learning Progressへの依存) |
| **Admin & Ops** | `admins`, `admin_audit_logs`, `ai_usage_logs` | 管理者権限、操作監査ログ(DBトリガーで自動記録。ADR-14)、AI呼び出しコストログの集約・利用状況ダッシュボード |

### ドメイン間依存関係

```mermaid
flowchart LR
    Plan[Learning Plan] -->|content_groups一覧を取得| Content[Content Catalog]
    Plan -->|無料枠判定/消費| Identity[Identity & Account]
    Plan -->|AI呼び出しログ記録| Admin[Admin & Ops]
    Content -->|TTS呼び出しログ記録| Admin
    Assessment[Assessment] -->|出題対象コンテンツ参照| Content
    Assessment -->|解答結果を記録| Progress[Learning Progress]
    Progress -->|コンテンツメタデータ参照\n表示用| Content
    Admin -.->|参照/更新は直接Supabase+RLS\n(監査はDBトリガー)| Identity
    Admin -.->|コンテンツCRUDは直接Supabase+RLS\n(監査はDBトリガー)| Content
```

矢印は「呼び出す側→呼び出される側」。実線はバックエンド内でのプロセス内呼び出し、破線はクライアントから直接Supabaseへアクセスする経路(バックエンドを介さない)を示す。`ai_usage_logs`への書き込みは、Learning Plan/Content Catalog側から直接INSERTするのではなく、Admin & Opsドメインが公開する`recordAiUsage(...)`関数を呼ぶ形に統一する(バックエンド専用テーブルへの書き込み経路を一本化するため)。

---

## 4. エンドポイント一覧(MVP)

### バックエンドREST API(実際に実装するもの)

| ドメイン | Method & Path | 説明 |
|---|---|---|
| Learning Plan | `POST /api/v1/plans/chat` | AIとの対話1ターン(ユーザー発話→AI応答)。会話はクライアント側で保持し、毎回文脈を渡す(MVPは簡易版のためサーバー側セッション永続化はしない) |
| Learning Plan | `POST /api/v1/plans` | 対話結果を元に学習計画(JSON)を確定生成。`target_lang`必須。`try_consume_plan_generation`で無料枠をアトミックに消費し、`learning_plans`に保存。同一言語でactiveな計画が既にあれば409 |
| Content Catalog | `POST /api/v1/content/listening-passages/{id}/audio` | OpenAI TTSで音声生成しSupabase Storageにキャッシュ保存(管理者操作)。`ai_usage_logs`にコスト記録 |
| Assessment | `POST /api/v1/assessments` | 指定した`content_groups`(`source_group_ids`)から出題ロジックでテストインスタンス(`tests`+`test_items`)を組み立てて生成 |
| Identity & Account | `DELETE /api/v1/identity/me` | 退会処理。`auth.users`削除はservice_role必須のため、Supabase Admin APIをバックエンド経由で呼ぶ |

**Admin & Opsドメインには専用エンドポイントなし**: コンテンツCRUD・ユーザー参照/ステータス変更・利用状況ダッシュボードの閲覧は、すべて`is_admin()`のRLSポリシーとDBトリガー(ADR-14)により直接Supabase経由で完結する。

### 直接Supabase(RLS)で完結する操作(参考・実装ガイド)

| 操作 | 備考 |
|---|---|
| サインアップ/ログイン/ログアウト | Supabase Auth標準機能。`profiles`行は`handle_new_user()`トリガーで自動作成 |
| コンテンツ閲覧(単語/文法/リスニング/コンテンツグループ/タグ) | `is_published=true`の公開読み取りRLSポリシー |
| 学習計画の閲覧・ステータス更新(完了/中断等) | 自分の行のみselect/update可能なRLSポリシー |
| 学習実績記録(`plan_day_logs`/`plan_week_logs`/`learning_records`) | 自分の行のみinsert可能なRLSポリシー。週次集計はPostgres ViewまたはRPC関数で提供し、これも直接Supabase経由(`supabase.rpc()`)で取得 |
| テスト結果の解答送信・閲覧 | `learning_records`へのinsert(自分の行のみ)。テスト完了判定はPostgresトリガーで`tests.status`を更新 |
| 管理者: コンテンツCRUD、ユーザー参照/ステータス変更 | `is_admin()`ベースのRLSポリシー。変更は自動的に`admin_audit_logs`へ記録(ADR-14) |
| 管理者: 利用状況ダッシュボード(AI呼び出し数・コスト) | `ai_usage_logs`/`admin_audit_logs`への管理者向けselectポリシー。集計はPostgres View |

---

## 5. リクエスト/レスポンス仕様

TypeScript型定義で記載する(バックエンド・Expoクライアント双方TypeScriptのため、そのまま型共有できる想定)。

### 5-1. `POST /api/v1/plans/chat`

```ts
interface PlanChatRequest {
  targetLang: string;       // 学習対象言語コード(例: "en")。MVPでは "en" のみ有効
  messages: ChatMessage[];  // 会話履歴全体。クライアント側で保持し毎回渡す(サーバー側セッション永続化なし)
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlanChatResponse {
  reply: string;            // AIの応答テキスト(チャットUIに表示)
  readyToGenerate: boolean; // true: 目標・レベル・週あたり学習時間が出揃い、計画生成に進める状態
}
```

**エラー**: `401 UNAUTHORIZED`(未ログイン)、`422 INVALID_MESSAGES`(`messages`が空/不正)、`502 AI_PROVIDER_ERROR`(Claude/OpenAI呼び出し失敗)

### 5-2. `POST /api/v1/plans`

```ts
interface CreatePlanRequest {
  targetLang: string;
  messages: ChatMessage[];  // 計画生成の根拠にする対話履歴(通常はchatで積み上げた全文脈)
}

interface LearningPlanResponse {
  id: string;
  targetLang: string;
  status: 'active';
  planJson: LearningPlanJSON; // data_model_design.md定義予定の型(フェーズ/週次タスク/月次タスク/マイルストーン)
  createdAt: string;          // ISO8601
}
```

**エラー**:
- `403 FREE_QUOTA_EXHAUSTED` — 無料枠(生涯1回、ユーザー単位)を既に消費済み。MVP時点では課金導線がないため回復手段なし(案内表示のみ)
- `409 ACTIVE_PLAN_EXISTS` — 同一`targetLang`で既にactiveな計画が存在(ADR-13の部分ユニーク制約)
- `422 INVALID_MESSAGES` / `502 AI_PROVIDER_ERROR` — 5-1と同様

### 5-3. `POST /api/v1/content/listening-passages/{id}/audio`

```ts
// path param: id = listening_passages.id

interface GenerateAudioRequest {
  voice?: string;            // OpenAI TTSの音声名。省略時は管理者設定のデフォルト音声
  forceRegenerate?: boolean; // true: キャッシュを無視して再生成(既定false)
}

interface GenerateAudioResponse {
  listeningPassageId: string;
  audioUrl: string;   // Supabase Storage上の音声ファイルURL
  cached: boolean;     // true: 既存キャッシュを返した(新規AI呼び出しなし)
  costUsd?: number;    // 新規生成時のみ付与(ai_usage_logsと同じ値)
}
```

**エラー**: `403 ADMIN_ONLY`(管理者以外)、`404 PASSAGE_NOT_FOUND`、`502 AI_PROVIDER_ERROR`

### 5-4. `POST /api/v1/assessments`

```ts
interface CreateAssessmentRequest {
  sourceGroupIds: string[]; // 出題対象とする content_groups.id の配列
  itemCount: number;        // 出題数
}

interface AssessmentResponse {
  id: string;                // tests.id
  status: 'in_progress';
  items: AssessmentItem[];   // 出題順
}

interface AssessmentItem {
  position: number;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing';
}
```

**エラー**: `404 GROUP_NOT_FOUND`(未公開/存在しないグループIDを含む)、`422 INSUFFICIENT_ITEMS`(`itemCount`が対象グループの保有数を超える)

### 5-5. `DELETE /api/v1/identity/me`

```ts
interface DeleteAccountRequest {
  confirmation: 'DELETE'; // 誤操作防止のための固定文字列確認
}
```

レスポンス: `204 No Content`

**エラー**: `400 CONFIRMATION_MISMATCH`、`401 UNAUTHORIZED`

### 5-6. 共通エラーコード一覧

| コード | HTTPステータス | 意味 |
|---|---|---|
| `UNAUTHORIZED` | 401 | JWT欠落・無効 |
| `ADMIN_ONLY` | 403 | 管理者権限が必要 |
| `FREE_QUOTA_EXHAUSTED` | 403 | AI学習計画生成の無料枠を消費済み |
| `ACTIVE_PLAN_EXISTS` | 409 | 同一言語でactiveな学習計画が既に存在 |
| `GROUP_NOT_FOUND` / `PASSAGE_NOT_FOUND` | 404 | 参照先リソースが存在しない/未公開 |
| `INVALID_MESSAGES` / `INSUFFICIENT_ITEMS` / `CONFIRMATION_MISMATCH` | 422 / 400 | リクエストボディのバリデーションエラー |
| `AI_PROVIDER_ERROR` | 502 | Claude/OpenAI呼び出し失敗(タイムアウト・レート制限含む) |

---

## 6. 未着手・今後の検討事項

- OpenAPI仕様書としての形式化(エンドポイント数が少ないため優先度は低い)
- 認証・認可の実装詳細(Supabase AuthとNode.jsバックエンドの連携方式、JWT検証の具体的なコード設計)
- `POST /api/v1/plans/chat`の会話コンテキストが長くなった場合のトークン数対策(要約・切り詰め戦略)

> 以前ここに記載していた「`LearningPlanJSON`型の正式定義」「テスト完了判定トリガーの実装」「監査ログ対象テーブル一覧の確定」は、`data_model_design.md`(DDL本体、`db_design_decisions_and_notes.md`のADR-13/14を踏まえて復元・作成)で対応済み
