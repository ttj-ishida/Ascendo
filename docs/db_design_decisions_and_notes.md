# DB設計 決定記録・運用補足

`data_model_design.md`(テーブル定義本体)を補足するドキュメント。「なぜその設計にしたか」という意思決定の経緯、実際にマイグレーションを組む際の実行順序、立ち上げ時の運用上の注意点をまとめる。

---

## 1. 設計決定記録(ADR: Architecture Decision Record)

DDLを読むだけでは伝わらない「検討した代替案」と「採用/却下の理由」を中心に記録する。

### ADR-01: コンテンツ本体はJSONBではなく種別ごとの専用テーブルで持つ

- **決定**: `learning_contents`は共通メタデータのみを持ち、単語・文法・リスニング・シャドーイングの実データは`vocabulary_items`等の専用テーブルに分離する(Class Table Inheritance方式)
- **検討した代替案**: `body jsonb`列に種別ごとに異なる構造を格納する方式(当初案)
- **却下理由**: JSONBだと(1)DBレベルの整合性チェックができない(例: 文法問題の`answer`が`choices`に含まれているかの保証)、(2)検索・インデックスが張りにくい(単語のオートコンプリート等)、(3)Supabaseの型生成の恩恵を受けられずTypeScript側で`Json`型のキャストが必要になる、という理由でテーブル管理を採用
- **残したJSONBの使い道**: 各詳細テーブルに`extra jsonb`列を残し、本当に自由なメモ用途(将来追加したくなる細かい項目)の逃げ道として温存

### ADR-02: item(1レコード)の粒度は「正誤等を個別記録できる最小単位」

- **決定**: 単語=1単語、文法=1問、リスニング=1問(音源は`listening_passages`で共有)、シャドーイング=1音源まるごと
- **検討した代替案**: 文法は「1トピック+複数問題」を1レコードにする案(当初案)
- **却下理由**: 複数問題を1レコードにまとめると「5問中どれを間違えたか」が記録できず、SRS(間隔反復、Phase2)が機能しない
- **副産物**: 音源(`listening_passages`)をリスニングとシャドーイングで共有できる設計になり、TTS生成コストの重複も避けられた

### ADR-03: コンテンツをまとめる単位として`content_groups`を導入

- **決定**: `learning_plans`は個々のコンテンツを直接持たず、`content_groups`(単語帳・問題集等)をID参照する
- **検討した代替案**: 学習計画のJSON内にコンテンツ本体(単語データ等)を直接埋め込む方式(当初案)
- **却下理由**: 複数ユーザー・複数の学習計画で同じ教材セットを再利用・共有できなくなるため

### ADR-04: 運用側の固定グループとユーザーの一時グループは1テーブルに統合

- **決定**: `content_groups`に`owner_type`('system'/'user')フラグを持たせ、1テーブルで両方を扱う
- **検討した代替案**: `content_groups`(system用)と`user_content_groups`(user用)にテーブルを分ける案
- **却下理由**: `content_group_items`・学習計画JSON・`tests.source_group_ids`など、グループを参照する側すべてで「どちらのテーブルを見るか」の判定が必要になり複雑化するため

### ADR-05: 学習計画とコンテンツグループの連携は、正規化テーブルを介さずJSON参照のみ

- **決定**: `learning_plans.plan_json`内の`contentGroupIds`(JSONB内の値)のみで`content_groups`を参照する
- **検討した代替案**: 参照整合性をDBレベルで保証するため、`plan_content_groups`という外部キー付きの正規化テーブルを追加する案(一度採用したが後に削除)
- **却下理由**: (1)`content_groups`は物理削除ではなく`is_published`による論理削除で運用する前提のため、参照切れの実害が起きにくいこと、(2)「このグループを使っている学習計画一覧」を検索する要件が現時点のMVPにはないこと、の2点から、書き込みが二重になる複雑さに見合わないと判断
- **再検討のタイミング**: 上記のような検索要件が具体化した時点、またはハードデリート運用に変える場合

### ADR-06: 実績記録は「日次を正、週次は目標値のみ」に役割分担

- **決定**: `plan_day_logs`(1日1レコード、実績時間・タスク実施チェック)を実績の一次データとし、`plan_week_logs`は「その週の目標時間(`plan_hours`)」と振り返りメモのみを持つ
- **検討した代替案**: `plan_week_logs`に実績時間・タスク実施チェックも持たせる案(当初案)
- **却下理由**: 「毎日15分」のような日次タスクは週1レコードでは実施日や継続日数(ストリーク)が追えないため。週次の実績集計は`plan_day_logs`からのSUMクエリで算出する方針とし、二重管理を避けた

### ADR-07: テストの結果は`test_items`ではなく`learning_records`に一本化

- **決定**: `test_items`はテストの構成(どの問題を何問目に出すか)のみを持ち、解答結果は`learning_records`に`test_id`を紐付けて記録する
- **検討した代替案**: `test_items`自体に`is_correct`等の結果列を持たせる案
- **却下理由**: 通常の練習とテスト経由の解答を同じ`learning_records`に記録することで、正答率集計や`user_vocabulary_progress`の更新ロジックを二重に持たずに済むため

### ADR-08: 単語コンテンツは英語/日本語固定ではなく「学習対象言語/母語」で持つ

- **決定**: `vocabulary_items`は`target_lang`/`target_text`/`target_phonetic`/`target_usage`(学習対象言語側)、`native_lang`/`native_text`/`native_phonetic`/`native_usage`(ユーザーの母語側)という言語非依存の列構成にする
- **理由**: ロードマップのPhase4「多言語学習対応」を見据え、将来英語⇔日本語以外の言語ペアが追加されても同じテーブル構造で対応できるようにするため
- **列名についての補足**: 当初`l1_*`/`l2_*`という汎用名を検討したが、言語学における一般的なL1(母語)/L2(学習対象言語)の用法と意味が逆になり、実装者が混乱するリスクがあったため、意味が列名から自明な`target_*`/`native_*`にリネームした

### ADR-09: ユーザーごとの単語習熟状態はコンテンツ本体と別テーブル

- **決定**: `user_vocabulary_progress`(cycle, memorized_at, forgotten_at)を`vocabulary_items`とは別テーブルにする
- **理由**: `vocabulary_items`は全ユーザー共有のコンテンツ本体であり、「誰が・どのサイクルで覚えたか」はユーザーごとに異なる状態のため。将来Phase2で文法・リスニングにも忘却曲線を適用する場合、同じパターンを他種別にも展開するか、汎用的な`user_content_progress`に一本化するかは実装時に再検討

### ADR-10: 有料/無料属性は「現在状態のキャッシュ」と「購入履歴」を分離

- **決定**: `profiles.plan_tier`/`paid_until`で現在状態を管理しつつ、`subscriptions`テーブルで購入・更新・解約の履歴を管理する
- **理由**: Phase2のストア課金(App Store/Google Play)実装時に、レシート検証結果や更新履歴を追跡する必要があるため
- **付随する対策**: `profiles`の`update_own`ポリシーだけだとユーザーが自分で`plan_tier`を書き換えられてしまうため、トリガー(`protect_plan_tier_columns`)で管理者/バックエンド以外からのこの2列の変更を禁止した

### ADR-11: ラベル(タグ)はカテゴリを固定せず自由入力の汎用機構にする

- **決定**: `tags`(category, name)+`content_tags`+`content_group_tags`という多対多構造。`category`は列挙型にせず自由入力のtext
- **理由**: 単語の品詞、文法の難易度・シチュエーション、コンテンツ全体のレベル分けなど、ラベルの種類・対象が多様で今後も増える可能性が高いため。固定の列挙型にすると増えるたびにマイグレーションが必要になる
- **既存の`difficulty`(数値)との関係**: 数値は並び替え・範囲検索、タグは複数付与・自由な軸での絞り込みに使い分ける

### ADR-12: `content_type`はenum型ではなくtext + CHECK制約にする

- **決定**: `learning_contents.type`/`content_groups.type`をPostgreSQLのenum型からtext + CHECK制約に変更
- **理由**: enum型は値の追加・削除にALTER TYPEとマイグレーションが必要になる。Phase3で`speaking`等の種別追加が見込まれるため、より変更コストの低いtext + CHECKを採用
- **一貫性のため据え置いたenum**: `plan_tier`、`subscription_status`、`subscription_store`、`content_group_owner_type`、`ai_usage_purpose`、`ai_usage_provider`は増減の見込みが低いためenum型のまま

### ADR-13: `learning_plans`を学習対象言語ごとに複数持てるようにする

- **決定**: `learning_plans`に`target_lang`(text)列を追加し、1ユーザーが言語ごとに独立した学習計画を持てる構造にする。同一ユーザー・同一`target_lang`で同時に有効(`status = 'active'`)な計画は1件までとする部分ユニークインデックス(`unique (profile_id, target_lang) where status = 'active'`)を設ける。過去の非activeな計画は複数残せる
- **理由**: Phase4「多言語学習対応」を見据えたスキーマ予約。MVP時点では`requirements_mvp.md`の通りUI・機能ともに英語学習のみを提供するため、実質的にユーザーは1言語分のactiveな計画しか作成できない
- **無料枠との関係**: AI学習計画生成の「生涯1回まで無料」判定(`try_consume_plan_generation`)は引き続きユーザー単位(`profiles.plan_generation_count`)で行い、言語ごとの個別カウントにはしない。将来複数言語のプランを作る場合、2回目以降のAI呼び出しはPhase2の課金判定ロジックに従う
- **影響範囲**: `plan_day_logs`/`plan_week_logs`は引き続き`learning_plans`への外部キー参照のみなので変更不要。ダッシュボード等で「どの`learning_plan`を表示するか」の選択ロジックは、MVP期間中は事実上1件しか存在しないため考慮不要とし、Phase4で複数言語が現れた時点で選択UIを追加検討する

### ADR-14: 管理者操作の監査ログはDBトリガーで自動記録

- **決定**: `learning_contents`、`content_groups`、`vocabulary_items`等の管理者編集対象テーブル、および`profiles`の保護列(`plan_tier`等)にAFTER UPDATE/DELETEトリガーを設置し、`is_admin()`なユーザーによる変更を`admin_audit_logs`へ自動記録する。差分抽出(`row_to_json(OLD)`/`row_to_json(NEW)`を`details`(jsonb)に格納)は共通のトリガー関数(例: `log_admin_action()`)に集約し、対象テーブルごとにトリガーとして紐付ける
- **検討した代替案**: アプリ層(Node.jsバックエンド)で管理者操作の都度、明示的に`recordAudit()`を呼ぶ方式
- **却下理由**: アプリ層記録方式だと、全ての管理者操作を必ずNode.jsバックエンド経由にする制約が生まれ、「単純なCRUDは直接Supabase+RLS」というハイブリッド構成の方針(API設計側で決定)と矛盾する。DBトリガーであれば経路(直接Supabase経由でもバックエンド経由でも)によらず確実に記録され、実装者の呼び忘れリスクもない
- **関連**: このADRはAPI設計(`docs/`配下の別ドキュメントで検討中)の「管理者操作は直接Supabase+RLSで完結させ、バックエンドはAI呼び出し等に限定する」という方針を成立させる前提になっている

---

## 2. マイグレーション実行順序

`data_model_design.md`はドキュメントとして読みやすい章立て(2-1, 2-2…)になっているが、実際にマイグレーションファイルを作る際は**外部キー依存関係に沿った順序**で実行する必要がある。以下の順序を推奨する。

1. `admins`(他のどのテーブルにも依存しない)
2. `public.is_admin()`関数(`admins`に依存)
3. `profiles`(`auth.users`, `is_admin()`に依存)
4. `public.handle_new_user()`関数 + `on_auth_user_created`トリガー(`profiles`, `auth.users`に依存)
5. `public.set_updated_at()`関数(依存なし、以降の各テーブルのトリガーで使用)
6. `public.protect_plan_tier_columns()`関数 + トリガー(`profiles`, `is_admin()`に依存)
7. `public.try_consume_plan_generation()`関数(`profiles`に依存)
8. `subscriptions`(`profiles`に依存)
9. `listening_passages`(`admins`に依存)
10. `learning_contents`(`listening_passages`, `admins`に依存)
11. `vocabulary_items` / `grammar_items` / `listening_items` / `shadowing_items`(`learning_contents`に依存)
12. `content_groups`(`admins`, `profiles`に依存)
13. `content_group_items`(`content_groups`, `learning_contents`に依存)
14. `tags`(依存なし)
15. `content_tags`(`learning_contents`, `tags`に依存) / `content_group_tags`(`content_groups`, `tags`に依存)
16. `learning_plans`(`profiles`に依存)
17. `plan_day_logs` / `plan_week_logs`(`learning_plans`に依存)
18. `tests`(`profiles`に依存)
19. `test_items`(`tests`, `learning_contents`に依存)
20. `learning_records`(`profiles`, `learning_contents`, `tests`に依存)
21. `user_vocabulary_progress`(`profiles`, `learning_contents`に依存)
22. `ai_usage_logs`(`profiles`, `learning_plans`, `listening_passages`に依存)
23. `admin_audit_logs`(`admins`に依存)
24. 各テーブルへの`set_updated_at`トリガー適用(該当テーブル作成後にまとめて実行可能)
25. `data_model_design.md`の「2-15. インデックス追加」に記載した各インデックス(対象テーブル作成後であればいつでも実行可能)

Supabase CLIを使う場合、`supabase migration new <名前>`でこの順序に沿った複数のマイグレーションファイルを作成していく想定。

---

## 3. 運用上の補足

### 3-1. 最初の管理者アカウントの作り方

`admins`テーブルには**クライアント向けのinsertポリシーを意図的に定義していない**(管理者アカウントの追加はアプリのUIから行わせない設計)。そのため、サービス立ち上げ時の最初の管理者は、Supabaseのダッシュボード(SQL Editor)またはservice_role権限での直接INSERTで作成する必要がある。

```sql
-- 例: 既にauth.usersにサインアップ済みのユーザーを最初の管理者にする
insert into public.admins (id, role) values ('<対象ユーザーのauth.uid>', 'superadmin');
```

2人目以降の管理者をどう追加するか(既存管理者が招待する機能を作るか、引き続きSQL Editorで手動対応するか)は、Phase2以降で管理者向け機能を作る際に検討する。

### 3-2. バックエンド専用テーブルへの書き込み

以下のテーブルは意図的にクライアント向けのinsert/updateポリシーを定義していない。**Node.jsバックエンドがservice_role権限でSupabaseに接続する場合のみ書き込み可能**(service_roleはRLSをバイパスする)。

- `ai_usage_logs`(AI呼び出しのたびにバックエンドが記録)
- `admin_audit_logs`(管理者操作のたびにバックエンドが記録)
- `subscriptions`(ストアのWebhook受信時にバックエンドが記録)

実装時は、これらのテーブルへの書き込みロジックが「anonキー/ユーザーの認証済みクライアント」ではなく「service_roleキー」を使ったサーバーサイド処理に確実に配置されていることを確認する。

### 3-3. 既知の未対応事項(意図的に見送ったもの)

`data_model_design.md`のレビュー時点で認識しているが、MVPでは対応を見送っている項目。実装時に問題が顕在化したら対応する。

- `tests`に`delete`ポリシーがなく、ユーザーが自分でテストを中断・破棄する手段がない
- `content_group_items` / `test_items`の`position`列に重複を防ぐ一意制約がない(重複しても動作はする)
- `ai_usage_logs.estimated_cost_usd`の数値精度(`numeric`の桁数)を指定していない

---

## 4. 関連ドキュメント

- `requirements_mvp.md` — MVP要件定義
- `requirements_supplementary.md` — 前提・制約・リスク・KPI・画面一覧
- `data_model_design.md` — テーブル定義(DDL)・学習計画JSONスキーマ本体
- `screen_flow.md` — 画面遷移図
