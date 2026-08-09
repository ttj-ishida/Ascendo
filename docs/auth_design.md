# Ascendo 認証・認可 実装設計

`api_design.md`の`shared/auth`(共有カーネル)を具体化するドキュメント。Supabase Authを前提に、Expoクライアント⇔Node.jsバックエンド⇔Supabaseの認証フローを設計する。

> 関連ファイル: `api_design.md`(API設計、`shared/auth`ミドルウェアへの言及元)、`data_model_design.md`(RLSポリシー、特に3-10/3-12の`profile_id = auth.uid()`前提)

---

## 1. 全体フロー

- **サインアップ/ログイン/ログアウト**: Expoクライアントが`supabase-js`のAuth機能で直接Supabaseとやり取りする(`api_design.md` 4章「直接Supabaseで完結する操作」の通り。バックエンドは関与しない)
- **トークン保存**: Expo SecureStore(iOS Keychain / Android Keystore)に`supabase-js`のセッション(アクセストークン・リフレッシュトークン)をカスタムストレージアダプタ経由で保存する(平文保存になる`AsyncStorage`単体は避ける)
- **セッション更新**: `supabase-js`がアクセストークンの期限切れを検知して自動的にリフレッシュする。バックエンドはリフレッシュに一切関与しない(ステートレスにアクセストークンを検証するのみ)
- **直接Supabase呼び出し**(コンテンツ閲覧・学習実績記録等): `supabase-js`がセッションのアクセストークンを自動付与するため、アプリ側で明示的なヘッダー操作は不要
- **バックエンドAPI呼び出し**(5本のエンドポイント): `Authorization: Bearer <access_token>`ヘッダーを明示的に付与する

---

## 2. バックエンドのJWT検証(`shared/auth`ミドルウェア)

**方式: ローカル検証(JWKS)**。Supabaseプロジェクトの公開鍵(JWKS)を使い、バックエンド内でJWTの署名・有効期限を検証する。リクエストのたびにSupabaseへ問い合わせる往復が発生せず、`ai_usage_logs`書き込みを伴うAI呼び出し系エンドポイントでもレイテンシ影響が小さい。

```ts
// shared/auth/verify.ts (概略)
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${SUPABASE_URL}/auth/v1`,
  });
  return payload; // payload.sub = auth.uid()
}
```

ミドルウェアは検証失敗時に`401 UNAUTHORIZED`を返し、成功時は`req.user = { id: payload.sub, accessToken: token }`をセットする。5本のバックエンドエンドポイント全てにこのミドルウェアを適用する。

---

## 3. 管理者ガード

対象は現状`POST /api/v1/content/listening-passages/{id}/audio`のみ(`api_design.md` 4章で唯一の管理者限定バックエンドエンドポイント)。

- `authMiddleware`通過後、`req.user.id`で`admins`テーブルを問い合わせて管理者かどうかを判定する`adminGuard`ミドルウェアを追加適用する
- 判定に使うSupabaseクライアントは4章の`userClient`(ユーザーのアクセストークンを転送)で良い。`admins`テーブルのRLS(`admins_select`: `is_admin()`)により、非管理者は自分が管理者かどうかの判定に必要な行を見られないが、`is_admin()`自体はSECURITY DEFINER関数なのでRLSに関係なく判定できる。したがって`adminGuard`は`is_admin()`をRPC呼び出しする形が最も簡潔:

```ts
const { data: isAdmin } = await userClient.rpc('is_admin');
if (!isAdmin) return res.status(403).json({ error: { code: 'ADMIN_ONLY', message: '...' } });
```

- MVP規模(管理者数名)ではキャッシュ不要。都度RPC呼び出しで十分

---

## 4. Supabaseクライアントの使い分け(2クライアント併用)

`data_model_design.md`のRLSは`learning_plans`/`tests`/`learning_records`等への書き込みを`profile_id = auth.uid()`で許可する設計のため、バックエンドがこれらに書き込む際は**ユーザー自身のアクセストークンをそのままSupabaseへ転送**する必要がある。一方`ai_usage_logs`・`admin_audit_logs`・`auth.users`の削除はservice_role権限が必須。この2つの要求を両立するため、バックエンドは用途別に2種類のSupabaseクライアントを使い分ける。

| クライアント | 生成タイミング | 認証情報 | 主な用途 |
|---|---|---|---|
| `userClient` | リクエストごとに生成(`req.user.accessToken`を使用) | ユーザーのアクセストークン(anonキー+ユーザーJWT) | `learning_plans`/`tests`/`test_items`/`learning_records`など、RLSが`auth.uid()`前提の書き込み |
| `serviceClient` | プロセス起動時に1つ生成、シングルトン | service_roleキー(環境変数、クライアントコードには絶対含めない) | `ai_usage_logs`書き込み、退会処理(`auth.admin.deleteUser`) |

```ts
// shared/supabase-client/index.ts (概略)
export function createUserClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

**5本のエンドポイントでの使い分け**:

| エンドポイント | userClient | serviceClient |
|---|---|---|
| `POST /plans/chat` | — (AI呼び出しのみ、DB書き込みなし) | `ai_usage_logs`記録(Admin & Ops経由) |
| `POST /plans` | `learning_plans`への insert | `ai_usage_logs`記録 |
| `POST /content/listening-passages/{id}/audio` | `listening_passages`のaudio_url更新(管理者は`is_admin()`によりRLS上も許可される) | `ai_usage_logs`記録 |
| `POST /assessments` | `tests`/`test_items`への insert | — |
| `DELETE /identity/me` | — | `auth.admin.deleteUser`(service_role必須) |

---

## 5. エラーレスポンス

`api_design.md` 5-6の共通エラーコード一覧に準拠する。

| コード | HTTPステータス | 発生箇所 |
|---|---|---|
| `UNAUTHORIZED` | 401 | `authMiddleware`でのJWT検証失敗(欠落・不正・期限切れ) |
| `ADMIN_ONLY` | 403 | `adminGuard`での管理者判定失敗 |

---

## 6. 今後の検討事項

- JWKSのキャッシュ更新間隔・Supabase側の鍵ローテーション発生時の挙動確認
- ユーザー単位のレートリミット(特に`POST /plans/chat`のAI呼び出し濫用対策)は未設計
- `auth.admin.deleteUser`実行時、関連テーブル(`profiles`等)の`on delete cascade`が実運用でも期待通り動くかの検証(`data_model_design.md`のDDL上は設定済み)
