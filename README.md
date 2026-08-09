# Ascendo

AIがユーザーのレベル・実績に応じて学習計画・学習コンテンツ出題を最適化する、多言語対応を見据えた学習アプリ。一般向けプロダクトとして公開する前提で設計中。

> このリポジトリは[StudyEnglish](https://github.com/ttj-ishida/StudyEnglish)(個人用の英語学習ロードマップツール)とは別プロジェクトです。元々は同リポジトリの`apps/ascendo/`として設計を進めていましたが、履歴を保持したまま本リポジトリに分割しました。

## 現在の状態

要件定義・DB設計(DDL含む)・API設計・認証認可設計まで完了。実装はまだ着手していません。

## ドキュメント

- [app_project_handoff.md](docs/app_project_handoff.md) — 全体サマリー・引き継ぎメモ(まずここから)
- [requirements_mvp.md](docs/requirements_mvp.md) — MVP要件定義
- [requirements_supplementary.md](docs/requirements_supplementary.md) — 前提・制約・リスク・KPI・画面一覧
- [screen_flow.md](docs/screen_flow.md) — 画面遷移図
- [data_model_design.md](docs/data_model_design.md) — テーブル定義(DDL)・学習計画JSONスキーマ
- [db_design_decisions_and_notes.md](docs/db_design_decisions_and_notes.md) — DB設計のADR・マイグレーション実行順序
- [api_design.md](docs/api_design.md) — APIアーキテクチャ・エンドポイント一覧・リクエスト/レスポンス仕様
- [auth_design.md](docs/auth_design.md) — 認証・認可の実装設計
- [db_migrations_plan.md](docs/db_migrations_plan.md) — Supabaseマイグレーション実装計画

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

**検証済み(2026-08-10)**: Docker/Supabase CLIが使えない環境で作成されたため、実際のSupabaseクラウドプロジェクトのダッシュボードSQL Editorで検証しました。全23マイグレーション適用 → `supabase/tests/smoke_test.sql`(構造確認)→ `supabase/tests/behavior_test.sql`(13項目の振る舞い確認、`begin/rollback`でデータは残さず)の順で全てパス。詳細は[db_migrations_plan.md](docs/db_migrations_plan.md)の「検証ステータス」参照。
