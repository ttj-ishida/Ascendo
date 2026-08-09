# Ascendo プロジェクト引き継ぎメモ(Claude Code向け)

Claude(claude.ai)との会話で行った要件定義〜DB設計のサマリー。実装フェーズを引き継ぐ際の起点として参照する。

> プロダクト名: **Ascendo**(旧称「学習アプリ」)。リポジトリ内の配置場所は`apps/ascendo/docs/`
> 関連ファイル一式: `requirements_mvp.md`、`requirements_supplementary.md`、`screen_flow.md`、`data_model_design.md`(未作成)、`db_design_decisions_and_notes.md`、`api_design.md`(本ファイルと合わせて7ファイル)
> ※英語学習ロードマップ個人利用ツール(`apps/roadmap-tool/`の`english_roadmap.html`等)とは**別プロジェクト**。混同注意。

---

## 1. プロジェクト概要

英語学習(将来的に多言語対応も見据える)を対象に、AIがユーザーのレベル・実績に応じて学習計画・コンテンツ出題を最適化するWeb/モバイルアプリ。一般向けプロダクトとして公開する前提。

| 項目 | 内容 |
|---|---|
| 利用想定 | 一般向けプロダクト |
| 対象プラットフォーム | Web + モバイル(iOS/Android) |
| 収益モデル | フリーミアム(ただしMVPは無料版のみ提供、Phase2でストア課金・広告を導入) |
| 想定規模 | ローンチ時100名程度、スケールアウト可能な設計を前提 |
| 技術スタック | Expo(React Native)+ TypeScript / Supabase(Auth, Postgres, Storage)/ Node.js(バックエンドAPI)/ Claude API・OpenAI API |

## 2. アクター

- **エンドユーザー**: サインアップ/ログイン、AIとの対話で学習計画作成、学習実行、実績記録
- **システム管理者**: 学習コンテンツのメンテ、ユーザー参照・更新
- **システム(AI/バックエンド)**: 学習計画生成、コンテンツ出題ロジック、忘却曲線管理(Phase2)、テスト・コンテンツの動的生成(Phase2)

## 3. MVPスコープ

詳細は`requirements_mvp.md`のスコープ表(15機能を✅/△/❌で仕分け)を参照。要点のみ:

**MVPに含む**: 認証、AIとの対話による学習計画生成(生涯1回まで無料)、学習コンテンツの学習・実績記録、管理者によるコンテンツCRUD・ユーザー管理、既存コンテンツからのテスト出題

**MVPでは対応しない(Phase2以降)**: 忘却曲線による復習最適化、AIによるコンテンツ動的生成、スピーキング練習(音声認識)、ストア課金・広告

## 4. 画面構成

`screen_flow.md`にMermaid形式の画面遷移図あり。主要画面:

- エンドユーザー: オンボーディング→サインアップ/ログイン→学習計画作成(AIチャット)→ダッシュボード→学習画面(単語/文法/リスニング)→実績画面/設定/アップグレード案内
- 管理者: 管理者ログイン→コンテンツ一覧・編集/リスニング音源生成/ユーザー一覧/利用状況ダッシュボード

## 5. DB設計サマリー

全23テーブル。詳細なDDL・RLSポリシーは`data_model_design.md`、設計判断の経緯は`db_design_decisions_and_notes.md`(ADR形式)を参照。ここでは実装時に押さえておくべき要点のみ記載する。

### 5-1. テーブル分類

| カテゴリ | テーブル |
|---|---|
| ユーザー・課金 | `profiles`, `subscriptions` |
| 管理者・監査 | `admins`, `admin_audit_logs`, `ai_usage_logs` |
| コンテンツ本体 | `learning_contents`(共通メタデータ)+ `vocabulary_items`/`grammar_items`/`listening_items`/`shadowing_items`(種別詳細)、`listening_passages`(音源) |
| コンテンツの束ね | `content_groups`, `content_group_items` |
| ラベル | `tags`, `content_tags`, `content_group_tags` |
| 学習計画 | `learning_plans`(`target_lang`列で学習対象言語ごとに分離、plan_jsonにフェーズ/週次タスク/月次タスク/マイルストーン) |
| 実績記録 | `plan_day_logs`(日次)、`plan_week_logs`(週次目標)、`learning_records`(コンテンツ単位の解答イベント) |
| ユーザー状態 | `user_vocabulary_progress`(単語ごとの忘却曲線用状態、cycle/memorized_at/forgotten_at) |
| テスト | `tests`, `test_items`(構成のみ。結果は`learning_records`に`test_id`で紐付け) |

### 5-2. 実装時に必ず押さえるべき設計方針

1. **コンテンツはJSONBではなくテーブル管理**(Class Table Inheritance)。`learning_contents`は共通メタデータのみ、実データは種別ごとの専用テーブル
2. **item(1レコード)の粒度**: 単語=1単語、文法=1問、リスニング=1問(音源は`listening_passages`で複数問が共有可)、シャドーイング=1音源まるごと
3. **学習計画はコンテンツを直接持たず`content_groups`をID参照**(`plan_json`内の`contentGroupIds`)。参照整合性はDB制約ではなく**アプリ側バリデーション**で担保する設計(理由はADR-05参照)
4. **実績は日次(`plan_day_logs`)が正、週次(`plan_week_logs`)は目標値のみ**。週次実績はSUMクエリで算出
5. **テスト結果は`learning_records`に一本化**(`test_items`は構成のみ)
6. **有料/無料属性**: `profiles.plan_tier`/`paid_until`はトリガーで保護されており、**管理者かバックエンド(service_role)経由でのみ変更可能**。フロントから直接更新しようとしても失敗する
7. **サインアップ時、`profiles`行は`auth.users`へのINSERTをトリガーに自動作成される**(`handle_new_user()`)。クライアント側で`profiles`へのinsert処理は不要(というより権限がない)
8. **AI学習計画生成の無料枠判定は`try_consume_plan_generation(user_id)`関数を使う**(行ロックでアトミックに判定・加算。素朴な「読んで+1して書き戻す」実装は競合状態を起こすため使わないこと)
9. **バックエンド専用テーブル**(`ai_usage_logs`, `admin_audit_logs`, `subscriptions`)はクライアント向けのinsertポリシーがない。これらへの書き込みは必ずNode.jsバックエンドがservice_role権限で行う
10. **最初の管理者アカウントはSupabase SQL Editorから手動INSERT**(アプリのUIからは作れない設計。詳細は`db_design_decisions_and_notes.md`の3-1)
11. **`learning_plans`は`target_lang`列を持ち、ユーザー・言語ごとにactiveな計画は1件まで**(部分ユニーク制約)。MVPは英語学習のみ提供するため実質1ユーザー1件だが、Phase4の多言語対応に向けたスキーマ予約(詳細はADR-13)。無料枠(生涯1回)は言語別ではなくユーザー単位のまま

### 5-3. マイグレーション順序

`db_design_decisions_and_notes.md`の「2. マイグレーション実行順序」に、外部キー依存関係に沿った24ステップの順序を記載済み。Supabase CLIでマイグレーションファイルを作成する際はこの順序に従うこと。

## 6. 学習計画JSONスキーマ

`data_model_design.md`の「3. 学習計画JSONスキーマ」にTypeScript型定義(`LearningPlanJSON`, `LearningPhase`, `WeeklyTask`, `MonthlyTask`)とJSON例を掲載済み。AIには既存の`content_groups`一覧をコンテキストとして渡し、`contentGroupIds`に実在するIDを埋め込ませる方式(コンテンツ自体は生成させない)。

## 7. 未着手・今後の検討事項

- **API設計**: エンドポイント一覧、リクエスト/レスポンス仕様(次フェーズの候補)
- **認証・認可の実装詳細**: SupabaseAuthとNode.jsバックエンドの連携方式、JWT検証
- **Phase2機能の詳細設計**: 忘却曲線アルゴリズム(SM-2等)、ストア課金(react-native-iap/RevenueCat)、広告SDK選定
- **残る要確認事項**(`requirements_mvp.md`より): 決済手段の最終選定、無料プランの追加制限値(運用しながら調整する前提)
- **既知の未対応事項**(`db_design_decisions_and_notes.md`より): `tests`の削除ポリシー、`position`列の一意制約、`ai_usage_logs`のコスト精度指定

## 8. このプロジェクトを引き継ぐ際の依頼例

- 「Supabaseのマイグレーションファイルを、記載の順序で実際に作成して」
- 「`learning_contents`のCRUD APIをNode.js + TypeScriptで実装して」
- 「AI学習計画生成のプロンプト設計を`content_groups`一覧を渡す前提で作って」
- 「API設計書(エンドポイント一覧)を作って」
