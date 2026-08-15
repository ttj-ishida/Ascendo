# Ascendo

AIがユーザーのレベル・実績に応じて学習計画・学習コンテンツ出題を最適化する、多言語対応を見据えた学習アプリ。一般向けプロダクトとして公開する前提で設計中。

> このリポジトリは[StudyEnglish](https://github.com/ttj-ishida/StudyEnglish)(個人用の英語学習ロードマップツール)とは別プロジェクトです。元々は同リポジトリの`apps/ascendo/`として設計を進めていましたが、履歴を保持したまま本リポジトリに分割しました。

## 現在の状態

要件定義・DB設計(DDL含む、実機検証済み)・API設計・認証認可設計・フロントエンド設計が完了。**バックエンド(`backend/`, 5エンドポイント)・フロントエンド(`mobile/`, 11画面)ともに実装済み**(自動テスト全パス・型チェッククリーン)。実機/シミュレータでの目視確認・実APIキーでの疎通確認は未実施(下記参照)。

## ドキュメント

- [app_project_handoff.md](docs/app_project_handoff.md) — 全体サマリー・引き継ぎメモ(まずここから)
- [requirements_mvp.md](docs/requirements_mvp.md) — MVP要件定義
- [requirements_supplementary.md](docs/requirements_supplementary.md) — 前提・制約・リスク・KPI・画面一覧
- [screen_flow.md](docs/screen_flow.md) — 画面遷移図
- [data_model_design.md](docs/data_model_design.md) — テーブル定義(DDL)・学習計画JSONスキーマ
- [db_design_decisions_and_notes.md](docs/db_design_decisions_and_notes.md) — DB設計のADR・マイグレーション実行順序
- [api_design.md](docs/api_design.md) — APIアーキテクチャ・エンドポイント一覧・リクエスト/レスポンス仕様
- [auth_design.md](docs/auth_design.md) — 認証・認可の実装設計
- [frontend_design.md](docs/frontend_design.md) — Expoフロントエンド画面設計
- [db_migrations_plan.md](docs/db_migrations_plan.md) — Supabaseマイグレーション実装計画(検証済み)
- [backend_implementation_plan.md](docs/backend_implementation_plan.md) — Node.jsバックエンド実装計画(実装・検証済み)
- [frontend_implementation_plan.md](docs/frontend_implementation_plan.md) — Expoフロントエンド実装計画(実装・検証済み)

## バックエンド(`backend/`)

Express + TypeScript。5エンドポイント全て実装済み、Docker・実APIキーなしで自動テストが通る設計(依存性注入でSupabase/AIクライアントをフェイクに差し替え可能)。

```bash
cd backend
npm install
npm test          # 39 tests, no network calls
npm run typecheck
npm run dev        # 実際に起動する場合は .env.example を .env にコピーして値を埋める
```

実際のSupabase/Claude/OpenAIに対する疎通確認は未実施(実APIキーが必要なため、意図的に手動検証のみ。詳細は[backend_implementation_plan.md](docs/backend_implementation_plan.md) Task 14参照)。

## フロントエンド(`mobile/`)

Expo Router + TypeScript。11画面全て実装済み。純粋ロジック(ライトナー式優先度計算、学習計画JSONパース、フォームバリデーション、認証ガード判定、正答率集計、経過時間計算等)はJestで自動テスト、画面(UI)自体は実機/シミュレータでの目視確認が必要(未実施)。

```bash
cd mobile
npm install
npm test          # 64 tests, no network calls
npx tsc --noEmit
npx expo start     # 実際に起動する場合は .env.example を .env にコピーして値を埋める
```

## 技術スタック

Expo(React Native)+ TypeScript / Supabase(Auth, Postgres, Storage)/ Node.js(バックエンドAPI)/ Claude API・OpenAI API

## Supabaseマイグレーション

`supabase/migrations/`に23個のマイグレーションファイルがあります。Docker Desktop + Supabase CLIがあれば:

```bash
npm run db:start
npm run db:reset
npm run db:smoke-test
npm run db:behavior-test
```

**検証済み(2026-08-10)**: Docker/Supabase CLIが使えない環境で作成されたため、実際のSupabaseクラウドプロジェクトのダッシュボードSQL Editorで検証しました。全24マイグレーション適用(`increment_actual_minutes()`追加分含む) → `supabase/tests/smoke_test.sql`(構造確認)→ `supabase/tests/behavior_test.sql`(14項目の振る舞い確認、`begin/rollback`でデータは残さず)の順で全てパス。詳細は[db_migrations_plan.md](docs/db_migrations_plan.md)の「検証ステータス」参照。
