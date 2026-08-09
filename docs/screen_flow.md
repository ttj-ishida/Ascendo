# 画面遷移設計

`requirements_supplementary.md` の「5. 画面一覧」を元に、画面間の遷移関係を図示する。Mermaid記法で記載しているため、対応するビューア(GitHub、多くのMarkdownエディタ等)でそのままフローチャートとして表示できる。

---

## 1. エンドユーザー向け画面遷移(MVP)

```mermaid
flowchart TD
    Splash["スプラッシュ/\nオンボーディング"] --> AuthGate{ログイン済み?}
    AuthGate -->|未ログイン| SignupOrLogin["サインアップ / ログイン選択"]
    AuthGate -->|ログイン済み| Dashboard

    SignupOrLogin -->|新規登録| Signup["サインアップ画面"]
    SignupOrLogin -->|既存アカウント| Login["ログイン画面"]

    Signup --> PlanCheck{学習計画あり?}
    Login --> PlanCheck

    PlanCheck -->|なし| PlanCreation["学習計画作成\n(AIチャット画面)"]
    PlanCheck -->|あり| Dashboard["ホーム/ダッシュボード画面"]

    PlanCreation -->|生成完了| Dashboard

    Dashboard --> VocabLearning["学習画面(単語)"]
    Dashboard --> GrammarLearning["学習画面(文法)"]
    Dashboard --> ListeningLearning["学習画面(リスニング)"]
    Dashboard --> Records["学習実績画面"]
    Dashboard --> Settings["設定画面"]
    Dashboard -->|無料枠上限到達時| UpgradeInfo["アップグレード案内画面\n(Phase2機能の紹介)"]

    VocabLearning -->|学習完了| Dashboard
    GrammarLearning -->|学習完了| Dashboard
    ListeningLearning -->|学習完了| Dashboard

    Settings -->|ログアウト| SignupOrLogin
```

## 2. システム管理者向け画面遷移(MVP)

```mermaid
flowchart TD
    AdminLogin["管理者ログイン画面"] --> AdminDashboard["管理者ダッシュボード"]
    AdminDashboard --> ContentList["学習コンテンツ一覧・編集画面"]
    AdminDashboard --> UserList["ユーザー一覧・詳細画面"]
    AdminDashboard --> UsageDashboard["利用状況ダッシュボード\n(AI呼び出し・コスト等)"]

    ContentList -->|新規/編集| ContentEdit["コンテンツ編集画面\n(単語/文法/リスニング)"]
    ContentEdit -->|リスニングの場合| AudioGen["リスニング音源生成画面\n(OpenAI TTS)"]
    AudioGen -->|生成・保存| ContentEdit
    ContentEdit -->|保存| ContentList

    UserList -->|詳細表示| UserDetail["ユーザー詳細画面"]
    UserDetail -->|ステータス変更| UserList
```

## 3. Phase 2以降の追加遷移(参考)

```mermaid
flowchart TD
    UpgradeInfo["アップグレード案内画面"] -->|Phase2で有効化| PlanSelect["課金/プラン選択画面"]
    PlanSelect -->|購入| StorePayment["ストア決済\n(App Store / Google Play)"]
    StorePayment -->|完了| Dashboard["ダッシュボード\n(有料プラン反映)"]

    Dashboard --> SpeakingLearning["学習画面(スピーキング)\nPhase3"]
    Dashboard --> ReviewSuggest["忘却曲線ベースの\n復習提案"]
```

---

## 4. 画面遷移設計の補足

- **未ログイン時のガード**: `AuthGate` は実装上、Expo Router等のミドルウェア/認証ガードで実現する想定。Supabase Authのセッション状態を見て未ログインなら `SignupOrLogin` にリダイレクトする
- **学習計画の有無判定(`PlanCheck`)**: サインアップ/ログイン直後、ユーザーに有効な `learning_plans`(status = 'active')が存在するかを確認し、なければ強制的に学習計画作成フローに誘導する
- **無料枠上限の判定**: `profiles.plan_generation_count` が1以上、かつ新しい計画を作ろうとした場合に `UpgradeInfo` へ誘導する(MVPでは購入導線はなく案内のみ)
- **管理者と一般ユーザーの認証分離**: `admins` テーブルの有無で権限判定を行う。同一のSupabase Auth基盤を使うが、管理者向け画面群は別途ルーティングを分離し、`is_admin()` のようなチェックをルートガードに組み込む
