# Ascendo Expo Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 11 end-user MVP screens defined in `docs/frontend_design.md` as an Expo Router app in its own `mobile/` subfolder (sibling to `backend/`, since the Ascendo repo root already has its own `package.json`/`supabase/` for the DB layer and can't also be `npx create-expo-app`'s target), against the already-implemented `backend/` (5 REST endpoints) and the verified Supabase schema (`supabase/migrations/`).

**Architecture:** Expo Router file-based routing, `(auth)` and `(app)` route groups per `frontend_design.md`§5. Every screen's business logic that can be expressed as a pure function (Leitner scheduling, plan-JSON parsing, form validation, auth-guard redirect decisions, score aggregation, time-elapsed math) lives in `src/features/*/`-scoped modules with no React/Expo imports, and is TDD'd with Jest exactly like the backend's domain services. Screens themselves (the actual `.tsx` files under `app/`) call these modules and are visually verified by running the app — not covered by automated component tests (see Global Constraints).

**Tech Stack:** Expo (React Native) + TypeScript, Expo Router, `@supabase/supabase-js`, `expo-secure-store`, `expo-linking`, `expo-av`, `@tanstack/react-query`, `zod`, Jest + `jest-expo` (test runner; this project uses Jest instead of `node:test` because RN component/logic tests need `jest-expo`'s React Native module mocks — see `frontend_design.md`§3)

## Global Constraints

- Every pure-logic module (no `react-native`/`expo-router`/React imports) must have Jest tests and is part of the automated `npm test` suite
- Screens (`app/**/*.tsx`) are written completely (no placeholders) but are **not** covered by automated component tests in this plan — each screen task ends with a "manual verification" step (`npx expo start`) that the plan documents but does not execute automatically. This mirrors the backend plan's Task 14: real device/simulator verification is a human-run step, not something this plan's automated suite claims to prove
- All Supabase table access from screens uses the patterns already decided in `api_design.md`§4 (direct Supabase + RLS for simple CRUD) and `frontend_design.md`§2 (`increment_actual_minutes()` for time tracking) — no new backend endpoints are introduced
- The 5 backend endpoints are called through a single `src/lib/api-client.ts` wrapper (adds the `Authorization: Bearer <token>` header, parses the `{ error: { code, message } }` envelope from `docs/api_design.md`§2) — no screen calls `fetch()` directly
- `app.json`: `"scheme": "ascendo"` (deep links), `"owner": "tetsuzi"`, `"slug": "ascendo"` (matches the Expo project already created at expo.dev/accounts/tetsuzi/projects/ascendo)
- Supabase project connection details (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are read from `app.config.ts`'s `extra` field, sourced from a gitignored `.env` — never hardcoded
- **All file paths in this plan (`package.json`, `app/_layout.tsx`, `src/lib/...`, etc.) are relative to `mobile/`, not the Ascendo repo root.** Every task's `Run` commands assume `mobile/` as the working directory (`cd mobile` once, or per-command — same convention `backend_implementation_plan.md` used for `backend/`)

## 検証ステータス: ✅ 実装・自動テスト検証済み(2026-08-16、実機/シミュレータでの目視確認のみ未実施)

全20タスクをこのセッション内でInline Executionにより実装。`npm test`(Jest, 64テスト)・`npx tsc --noEmit`を各タスックで実際に実行しながら進めた。

- `npm test`: **64件全てPASS**(18テストスイート)
- `npx tsc --noEmit`: エラーなし
- 画面(UI)自体の実機/シミュレータでの目視確認(`npx expo start`)は、Global Constraintsに記載の通り意図的に自動化対象外。人間による確認が必要

**計画からの逸脱・実装中に見つけた問題(4件、いずれも修正済み。詳細は各タスックの本文に記載)**:
1. **Task 1**: リポジトリルートに既存の`package.json`/`backend/`/`docs/`/`supabase/`があり、`npx create-expo-app@latest .`をルートで実行できなかった。`mobile/`サブフォルダに配置する形に計画全体を修正(実行前に発見)
2. **Task 1**: Expo SDK 57 / React Native 0.86 / React 19.2の依存関係で、`--legacy-peer-deps`必須、`jest`を`^29.x`系に固定、`@react-native/jest-preset`を`react-native`と厳密に同じバージョンに固定、`react-test-renderer`を`jest-expo`が同梱するバージョンに固定、`tsconfig.json`に`"types": ["jest"]`追加——という5つのバージョン起因の問題を解決(詳細はTask 1 Step 2の「Version-pinning notes」)
3. **Task 11 (実装前提として発見)**: バックエンドの`generatePlan()`プロンプトが`MonthlyTask.done`フィールドを生成する指示になっていない不整合、および`AssessmentRunner`配線に必要なコンテンツグループ選択UXが未設計——の2点を「未着手・今後の検討事項」に記録
4. **Task 15**: `if (learningPlanId) useStudyTimer(learningPlanId)`という条件付きフック呼び出しがReactのRules of Hooks違反(`tsc`では検出されない)。`useStudyTimer`を`string | null`受け取り+内部no-opに変更し、無条件呼び出しに修正(Task 12/15/16/17全てに反映)
5. **計画外(検証セッション中)**: `npx expo start --web`での動作確認用に`react-dom`/`react-native-web`を追加インストールしたが、その場でコミット・pushし忘れていた。ユーザーが手順に従って`git clone`→`npm install`したところ`Unable to resolve "react-native-web/dist/index"`で失敗し、この欠落が発覚(該当コミットで修正済み)。**教訓**: 検証セッション中に加えた`package.json`変更は、検証が終わった直後にその場でコミットすること
6. **既知の制約(Web限定)**: `expo-secure-store`はWebプラットフォーム非対応のため、`--web`実行時はアプリ起動直後に`ExpoSecureStore.default.getValueWithKeyAsync is not a function`でクラッシュする。Ascendoはモバイルアプリとして設計されているため未対応のまま(iOS/Android/Expo Goでは問題なし)。Web版でもログイン等を動かすには`secure-store-adapter.ts`をプラットフォーム分岐させる追加実装が必要(未着手)

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `app.json` → replaced by `app.config.ts`, `tsconfig.json`, `jest.config.js`, `.env.example`, `.gitignore`, `babel.config.js`
- Create: `app/_layout.tsx` (minimal), `app/index.tsx` (placeholder)
- Test: `src/lib/__tests__/sanity.test.ts`

**Interfaces:**
- Produces: a running `npm test` (Jest) and `npx expo start` inside `mobile/`

- [x] **Step 1: Scaffold the Expo project into its own `mobile/` subfolder**

Run (from the Ascendo repo root):
```bash
mkdir mobile
cd mobile
npx create-expo-app@latest . --template blank-typescript
```
Expected: `mobile/package.json`, `mobile/app.json`, `mobile/App.tsx`, `mobile/tsconfig.json` created. Delete the generated `App.tsx` — Expo Router (Step 3) replaces it with `app/_layout.tsx`. **All subsequent steps in this plan run with `mobile/` as the working directory.**

- [x] **Step 2: Install dependencies**

Run:
```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens expo-secure-store expo-av
npm install @supabase/supabase-js @tanstack/react-query zod react-native-url-polyfill dotenv --legacy-peer-deps
npm install --save-dev jest@^29.7.0 jest-expo @react-native/jest-preset@0.86.2 @testing-library/react-native react-test-renderer@19.2.3 @types/jest --legacy-peer-deps
```

**Version-pinning notes (found by actually running this against Expo SDK 57 / React Native 0.86 / React 19.2 — the versions in play when this task was executed; a different SDK generation will need different pins, re-derive them the same way):**
- `--legacy-peer-deps` is required throughout: `expo-router`'s web-only dependency chain (`vaul`/`@radix-ui/*`) declares a `react-dom` peer this RN-only project doesn't have, and `react-test-renderer`'s exact-version peer on `react` is stricter than what plain `npm install` resolves cleanly
- `jest` must be pinned to the `^29.x` family — `jest-expo`'s bundled internals (`@jest/globals`, `jest-snapshot`, `jest-environment-jsdom`, all pinned `^29.2.1`) are incompatible with `jest@30`'s `jest-mock` API (`clearMocksOnScope` missing → every test suite fails to even load)
- `@react-native/jest-preset` must be pinned to **exactly** the installed `react-native` version (`0.86.2` here) — a newer preset version references files (`react-native/src/setup-env.js`) that don't exist at that path in an older `react-native`, and vice versa. Check `node_modules/react-native/package.json`'s `version` before picking this pin
- `react-test-renderer` must match `jest-expo`'s own pinned version (visible in `node_modules/jest-expo/package.json`'s `dependencies.react-test-renderer`, `19.2.3` here) — not just "some 19.x", since `npm install react-test-renderer` alone resolves to whatever the latest patch is, which can be ahead of what `jest-expo` and the installed `react` both expect
- If `npm test` fails with an unfamiliar jest-internals error after these installs, check `node_modules/jest-expo/package.json`'s `dependencies`/`peerDependencies` block first — it's the source of truth for what versions the other packages must match
- The generated `tsconfig.json` (`{ "extends": "expo/tsconfig.base", "compilerOptions": { "strict": true } }`) does not pick up `@types/jest` on its own — `npx tsc --noEmit` fails with `Cannot find name 'test'/'expect'` in every `*.test.ts` file until `"types": ["jest"]` is added to `compilerOptions`

- [x] **Step 3: Configure Expo Router**

`package.json`: set `"main": "expo-router/entry"`.

`app.config.ts` (replaces `app.json`):
```ts
import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Ascendo',
  slug: 'ascendo',
  owner: 'tetsuzi',
  scheme: 'ascendo',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  },
};

export default config;
```

Delete `app.json` (superseded by `app.config.ts`).

- [x] **Step 4: `.env.example` and `.gitignore`**

`.env.example`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=
API_BASE_URL=http://localhost:3000
```

`.gitignore` (append to whatever `create-expo-app` generated):
```
.env
```

- [x] **Step 5: Configure Jest**

`jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
```

Add to `package.json` `scripts`: `"test": "jest"`.

- [x] **Step 6: Write and pass a sanity test**

`src/lib/__tests__/sanity.test.ts`:
```ts
test('jest is wired up', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: PASS — 1 test

- [x] **Step 7: Minimal root layout so `npx expo start` boots**

`app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
```

`app/index.tsx`:
```tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Ascendo</Text>
    </View>
  );
}
```

- [x] **Step 8: Manual verification**

Run: `npx expo start` and open in Expo Go (phone) or a simulator.
Expected: a blank screen showing the text "Ascendo". **(Human-run — this plan does not execute `expo start` itself.)**

- [x] **Step 9: Commit**

```bash
git add package.json package-lock.json app.config.ts tsconfig.json jest.config.js babel.config.js \
        .env.example .gitignore app/_layout.tsx app/index.tsx src/lib/__tests__/sanity.test.ts
git rm --cached app.json 2>/dev/null; true
git commit -m "chore(frontend): scaffold Expo Router project"
```

---

### Task 2: Design tokens + base components + formatting helpers

**Files:**
- Create: `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/theme/typography.ts`
- Create: `src/components/Card.tsx`, `src/components/PrimaryButton.tsx`, `src/components/ProgressBar.tsx`, `src/components/TextField.tsx`
- Create: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces: `colors` (object: `primary`, `primaryLight`, `background`, `text`, `textMuted`, `danger`), `formatMinutes(totalMinutes: number): string`, `formatPercent(ratio: number): string` (used by Home/Records in later tasks)

- [x] **Step 1: Write the failing test for the formatting helpers**

`src/lib/__tests__/format.test.ts`:
```ts
import { formatMinutes, formatPercent } from '../format';

test('formatMinutes renders under an hour as "N分"', () => {
  expect(formatMinutes(45)).toBe('45分');
});

test('formatMinutes renders an hour or more as "H時間M分"', () => {
  expect(formatMinutes(125)).toBe('2時間5分');
});

test('formatMinutes renders exactly on the hour without a minutes part', () => {
  expect(formatMinutes(120)).toBe('2時間');
});

test('formatPercent rounds to the nearest whole percent', () => {
  expect(formatPercent(0.666)).toBe('67%');
  expect(formatPercent(0)).toBe('0%');
  expect(formatPercent(1)).toBe('100%');
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../format'`

- [x] **Step 3: Implement `src/lib/format.ts`**

```ts
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 5 tests (sanity + 4 above)

- [x] **Step 5: Theme tokens**

`src/theme/colors.ts`:
```ts
export const colors = {
  primary: '#6FCF97',
  primaryLight: '#F2FAF6',
  background: '#FFFFFF',
  text: '#2D3748',
  textMuted: '#718096',
  danger: '#E53E3E',
  border: '#E2E8F0',
};
```

`src/theme/spacing.ts`:
```ts
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
```

`src/theme/typography.ts`:
```ts
export const typography = {
  heading: { fontSize: 24, fontWeight: '700' as const },
  subheading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
```

- [x] **Step 6: Base components (no tests — pure presentation, verified visually per Global Constraints)**

`src/components/Card.tsx`:
```tsx
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
```

`src/components/PrimaryButton.tsx`:
```tsx
import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

`src/components/ProgressBar.tsx`:
```tsx
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function ProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
});
```

`src/components/TextField.tsx`:
```tsx
import { TextInput, View, Text, StyleSheet, type TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, error && styles.inputError]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
});
```

- [x] **Step 7: Commit**

```bash
git add src/theme src/components src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat(frontend): add design tokens, base components, format helpers"
```

---

### Task 3: Supabase client + SecureStore adapter

**Files:**
- Create: `src/lib/secure-store-adapter.ts`
- Create: `src/lib/supabase.ts`
- Test: `src/lib/__tests__/secure-store-adapter.test.ts`

**Interfaces:**
- Produces: `createSecureStoreAdapter(store: SecureStoreLike): SupportedStorage` (`SecureStoreLike` = the subset of `expo-secure-store`'s API used: `getItemAsync`, `setItemAsync`, `deleteItemAsync`), `supabase: SupabaseClient` (singleton, used directly by every screen for direct-Supabase reads/writes per `api_design.md`§4)

- [x] **Step 1: Write the failing test**

`src/lib/__tests__/secure-store-adapter.test.ts`:
```ts
import { createSecureStoreAdapter, type SecureStoreLike } from '../secure-store-adapter';

function fakeStore(): SecureStoreLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: async (key: string) => data[key] ?? null,
    setItemAsync: async (key: string, value: string) => { data[key] = value; },
    deleteItemAsync: async (key: string) => { delete data[key]; },
  };
}

test('adapter.setItem then getItem round-trips through the store', async () => {
  const store = fakeStore();
  const adapter = createSecureStoreAdapter(store);

  await adapter.setItem('sb-session', '{"token":"abc"}');
  const value = await adapter.getItem('sb-session');

  expect(value).toBe('{"token":"abc"}');
  expect(store.data['sb-session']).toBe('{"token":"abc"}');
});

test('adapter.getItem returns null for a missing key', async () => {
  const adapter = createSecureStoreAdapter(fakeStore());
  await expect(adapter.getItem('missing')).resolves.toBeNull();
});

test('adapter.removeItem deletes the key from the store', async () => {
  const store = fakeStore();
  const adapter = createSecureStoreAdapter(store);
  await adapter.setItem('k', 'v');

  await adapter.removeItem('k');

  expect(store.data['k']).toBeUndefined();
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../secure-store-adapter'`

- [x] **Step 3: Implement `src/lib/secure-store-adapter.ts`**

```ts
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** supabase-js's SupportedStorage interface, satisfied via expo-secure-store (Keychain/Keystore). */
export interface SupportedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createSecureStoreAdapter(store: SecureStoreLike): SupportedStorage {
  return {
    getItem: (key) => store.getItemAsync(key),
    setItem: (key, value) => store.setItemAsync(key, value),
    removeItem: (key) => store.deleteItemAsync(key),
  };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Wire the real `expo-secure-store` module and create the Supabase client singleton**

`src/lib/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { createSecureStoreAdapter } from './secure-store-adapter';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing from app.config.ts extra');
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    storage: createSecureStoreAdapter(SecureStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [x] **Step 6: Confirm the polyfill dependency Step 5 relies on is installed**

`react-native-url-polyfill` was already added in Task 1 Step 2 (moved forward once this dependency was discovered, so Task 1's single install pass covers everything). Run: `node -e "require.resolve('react-native-url-polyfill/auto')"` — no output/exit code 0 means it's present; otherwise run `npm install react-native-url-polyfill --legacy-peer-deps`.
(Required because `@supabase/supabase-js` expects a `URL` global that isn't present in the React Native JS runtime without this polyfill.)

- [x] **Step 7: Run full suite once more**

Run: `npm test`
Expected: PASS — all tests still pass (this task added no new test-only logic beyond Step 1-4; Steps 5-6 are runtime wiring, not unit-tested per Global Constraints since they require the real Expo runtime)

- [x] **Step 8: Commit**

```bash
git add src/lib/secure-store-adapter.ts src/lib/supabase.ts src/lib/__tests__/secure-store-adapter.test.ts package.json package-lock.json
git commit -m "feat(frontend): add Supabase client with SecureStore session persistence"
```

---

### Task 4: AuthContext (session state)

**Files:**
- Create: `src/features/auth/auth-reducer.ts`
- Create: `src/features/auth/AuthContext.tsx`
- Test: `src/features/auth/__tests__/auth-reducer.test.ts`

**Interfaces:**
- Produces: `type AuthState = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; userId: string; accessToken: string }`, `authReducer(state: AuthState, event: AuthEvent): AuthState`, `useAuth(): AuthState` (React hook, consumed by Task 10's guard layout)

- [x] **Step 1: Write the failing test for the reducer (the actual testable logic)**

`src/features/auth/__tests__/auth-reducer.test.ts`:
```ts
import { authReducer, type AuthState } from '../auth-reducer';

const LOADING: AuthState = { status: 'loading' };

test('SIGNED_IN event moves from loading to signed-in with user/token', () => {
  const next = authReducer(LOADING, {
    type: 'SIGNED_IN',
    userId: '11111111-1111-1111-1111-111111111111',
    accessToken: 'tok-abc',
  });
  expect(next).toEqual({
    status: 'signed-in',
    userId: '11111111-1111-1111-1111-111111111111',
    accessToken: 'tok-abc',
  });
});

test('SIGNED_OUT event moves to signed-out from any prior state', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'x', accessToken: 'y' };
  expect(authReducer(signedIn, { type: 'SIGNED_OUT' })).toEqual({ status: 'signed-out' });
});

test('INITIAL_SESSION with no session moves loading to signed-out', () => {
  expect(authReducer(LOADING, { type: 'INITIAL_SESSION', session: null })).toEqual({ status: 'signed-out' });
});

test('INITIAL_SESSION with a session moves loading to signed-in', () => {
  const next = authReducer(LOADING, {
    type: 'INITIAL_SESSION',
    session: { userId: 'u1', accessToken: 't1' },
  });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 't1' });
});

test('TOKEN_REFRESHED updates the access token while staying signed-in', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 'old' };
  const next = authReducer(signedIn, { type: 'TOKEN_REFRESHED', accessToken: 'new' });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 'new' });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../auth-reducer'`

- [x] **Step 3: Implement `src/features/auth/auth-reducer.ts`**

```ts
export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; accessToken: string };

export type AuthEvent =
  | { type: 'INITIAL_SESSION'; session: { userId: string; accessToken: string } | null }
  | { type: 'SIGNED_IN'; userId: string; accessToken: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'TOKEN_REFRESHED'; accessToken: string };

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session
        ? { status: 'signed-in', userId: event.session.userId, accessToken: event.session.accessToken }
        : { status: 'signed-out' };
    case 'SIGNED_IN':
      return { status: 'signed-in', userId: event.userId, accessToken: event.accessToken };
    case 'SIGNED_OUT':
      return { status: 'signed-out' };
    case 'TOKEN_REFRESHED':
      return state.status === 'signed-in' ? { ...state, accessToken: event.accessToken } : state;
  }
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 5 new tests

- [x] **Step 5: Wire the reducer to `supabase.auth.onAuthStateChange` in a React context**

`src/features/auth/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { authReducer, type AuthState } from './auth-reducer';

const AuthStateContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { status: 'loading' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      dispatch({
        type: 'INITIAL_SESSION',
        session: data.session
          ? { userId: data.session.user.id, accessToken: data.session.access_token }
          : null,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGNED_OUT' });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        dispatch({ type: 'TOKEN_REFRESHED', accessToken: session.access_token });
      } else if (session) {
        dispatch({ type: 'SIGNED_IN', userId: session.user.id, accessToken: session.access_token });
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <AuthStateContext.Provider value={state}>{children}</AuthStateContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthStateContext);
}
```

- [x] **Step 6: Mount `AuthProvider` in the root layout**

Modify `app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/features/auth/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  );
}
```

- [x] **Step 7: Run full suite**

Run: `npm test`
Expected: PASS — all tests (Step 6 is runtime wiring, not separately unit-tested)

- [x] **Step 8: Commit**

```bash
git add src/features/auth/auth-reducer.ts src/features/auth/AuthContext.tsx \
        src/features/auth/__tests__/auth-reducer.test.ts app/_layout.tsx
git commit -m "feat(frontend): add AuthContext wired to supabase.auth.onAuthStateChange"
```

---

### Task 5: Auth validation schemas

**Files:**
- Create: `src/features/auth/schemas.ts`
- Test: `src/features/auth/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `emailSchema`, `passwordSchema` (zod, min 8 chars), `signUpSchema` (email + password + confirmPassword, refined to match), `logInSchema`, `forgotPasswordSchema`, `resetPasswordSchema` — all consumed by Tasks 7-9's screens

- [x] **Step 1: Write the failing test**

`src/features/auth/__tests__/schemas.test.ts`:
```ts
import { signUpSchema, logInSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas';

test('signUpSchema accepts matching passwords >= 8 chars and a valid email', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  });
  expect(result.success).toBe(true);
});

test('signUpSchema rejects mismatched passwords', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'different1',
  });
  expect(result.success).toBe(false);
});

test('signUpSchema rejects a password shorter than 8 characters', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'short1',
    confirmPassword: 'short1',
  });
  expect(result.success).toBe(false);
});

test('signUpSchema rejects an invalid email', () => {
  const result = signUpSchema.safeParse({
    email: 'not-an-email',
    password: 'password123',
    confirmPassword: 'password123',
  });
  expect(result.success).toBe(false);
});

test('logInSchema accepts any non-empty password (strength is only enforced at signup)', () => {
  expect(logInSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  expect(logInSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
});

test('forgotPasswordSchema requires a valid email', () => {
  expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
});

test('resetPasswordSchema requires matching passwords >= 8 chars', () => {
  expect(
    resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'password123' }).success,
  ).toBe(true);
  expect(
    resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'nomatch12' }).success,
  ).toBe(false);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../schemas'`

- [x] **Step 3: Implement `src/features/auth/schemas.ts`**

```ts
import { z } from 'zod';

export const emailSchema = z.string().email('メールアドレスの形式が正しくありません');
export const passwordSchema = z.string().min(8, 'パスワードは8文字以上で入力してください');

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 7 new tests

- [x] **Step 5: Commit**

```bash
git add src/features/auth/schemas.ts src/features/auth/__tests__/schemas.test.ts
git commit -m "feat(frontend): add zod validation schemas for auth forms"
```

---

### Task 6: Onboarding flag + onboarding/signup-or-login screens

**Files:**
- Create: `src/lib/onboarding-flag.ts`
- Create: `app/(auth)/onboarding.tsx`, `app/(auth)/signup-or-login.tsx`
- Test: `src/lib/__tests__/onboarding-flag.test.ts`

**Interfaces:**
- Produces: `hasSeenOnboarding(store: SecureStoreLike): Promise<boolean>`, `markOnboardingSeen(store: SecureStoreLike): Promise<void>` (uses the same `SecureStoreLike` interface from Task 3)

- [x] **Step 1: Write the failing test**

`src/lib/__tests__/onboarding-flag.test.ts`:
```ts
import { hasSeenOnboarding, markOnboardingSeen } from '../onboarding-flag';
import type { SecureStoreLike } from '../secure-store-adapter';

function fakeStore(): SecureStoreLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: async (key) => data[key] ?? null,
    setItemAsync: async (key, value) => { data[key] = value; },
    deleteItemAsync: async (key) => { delete data[key]; },
  };
}

test('hasSeenOnboarding is false before markOnboardingSeen is called', async () => {
  await expect(hasSeenOnboarding(fakeStore())).resolves.toBe(false);
});

test('hasSeenOnboarding is true after markOnboardingSeen', async () => {
  const store = fakeStore();
  await markOnboardingSeen(store);
  await expect(hasSeenOnboarding(store)).resolves.toBe(true);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../onboarding-flag'`

- [x] **Step 3: Implement `src/lib/onboarding-flag.ts`**

```ts
import type { SecureStoreLike } from './secure-store-adapter';

const KEY = 'ascendo-has-seen-onboarding';

export async function hasSeenOnboarding(store: SecureStoreLike): Promise<boolean> {
  return (await store.getItemAsync(KEY)) === 'true';
}

export async function markOnboardingSeen(store: SecureStoreLike): Promise<void> {
  await store.setItemAsync(KEY, 'true');
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 2 new tests

- [x] **Step 5: Write the screens**

`app/(auth)/onboarding.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { markOnboardingSeen } from '../../src/lib/onboarding-flag';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function Onboarding() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ascendo</Text>
      <Text style={styles.body}>AIがあなたのレベルに合わせて学習計画を作ります。</Text>
      <PrimaryButton
        title="はじめる"
        onPress={async () => {
          await markOnboardingSeen(SecureStore);
          router.replace('/(auth)/signup-or-login');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.heading, color: colors.primary, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.text, marginBottom: spacing.xl, textAlign: 'center' },
});
```

`app/(auth)/signup-or-login.tsx`:
```tsx
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function SignupOrLogin() {
  return (
    <View style={styles.container}>
      <PrimaryButton title="新規登録" onPress={() => router.push('/(auth)/sign-up')} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="ログイン" onPress={() => router.push('/(auth)/log-in')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
});
```

- [x] **Step 6: Manual verification**

Run: `npx expo start`, navigate to the onboarding screen.
Expected: "はじめる" navigates to the signup-or-login choice; both buttons are present and route to (not-yet-implemented, Task 7/8) `/sign-up` and `/log-in`. **(Human-run.)**

- [x] **Step 7: Commit**

```bash
git add src/lib/onboarding-flag.ts src/lib/__tests__/onboarding-flag.test.ts \
        "app/(auth)/onboarding.tsx" "app/(auth)/signup-or-login.tsx"
git commit -m "feat(frontend): add onboarding flag and onboarding/signup-or-login screens"
```

---

### Task 7: Sign-up + confirmation + deep-link parsing

**Files:**
- Create: `src/lib/deep-link.ts`
- Create: `app/(auth)/sign-up.tsx`, `app/(auth)/sign-up-confirm.tsx`
- Test: `src/lib/__tests__/deep-link.test.ts`

**Interfaces:**
- Produces: `parseAuthDeepLink(url: string): 'signup-confirm' | 'password-recovery' | null` (consumed here and by Task 9's reset-password screen)

- [x] **Step 1: Write the failing test**

`src/lib/__tests__/deep-link.test.ts`:
```ts
import { parseAuthDeepLink } from '../deep-link';

test('recognizes a signup confirmation link', () => {
  expect(parseAuthDeepLink('ascendo://sign-up-confirm#access_token=abc&type=signup')).toBe('signup-confirm');
});

test('recognizes a password recovery link', () => {
  expect(parseAuthDeepLink('ascendo://reset-password#access_token=abc&type=recovery')).toBe('password-recovery');
});

test('returns null for an unrelated URL', () => {
  expect(parseAuthDeepLink('ascendo://onboarding')).toBeNull();
});

test('returns null for a malformed URL', () => {
  expect(parseAuthDeepLink('not a url')).toBeNull();
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../deep-link'`

- [x] **Step 3: Implement `src/lib/deep-link.ts`**

```ts
export function parseAuthDeepLink(url: string): 'signup-confirm' | 'password-recovery' | null {
  try {
    const parsed = new URL(url);
    const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(fragment);
    const type = params.get('type');

    if (type === 'signup') return 'signup-confirm';
    if (type === 'recovery') return 'password-recovery';
    return null;
  } catch {
    return null;
  }
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 4 new tests

- [x] **Step 5: Write the sign-up screen**

`app/(auth)/sign-up.tsx`:
```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { signUpSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitError(null);
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: { emailRedirectTo: 'ascendo://sign-up-confirm' },
    });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace('/(auth)/sign-up-confirm');
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <TextField label="パスワード" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      <TextField label="パスワード(確認)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} />
      {submitError ? <TextField label="" value={submitError} editable={false} error={submitError} /> : null}
      <PrimaryButton title="新規登録" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
});
```

`app/(auth)/sign-up-confirm.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function SignUpConfirm() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>確認メールを送信しました</Text>
      <Text style={styles.body}>メール内のリンクをタップすると自動的にログインされます。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.subheading, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
```

- [x] **Step 6: Wire deep-link handling into the root layout**

Modify `app/_layout.tsx` to listen for incoming links and route accordingly:
```tsx
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../src/features/auth/AuthContext';
import { parseAuthDeepLink } from '../src/lib/deep-link';

export default function RootLayout() {
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const kind = parseAuthDeepLink(url);
      if (kind === 'signup-confirm') router.replace('/(app)');
      if (kind === 'password-recovery') router.replace('/(auth)/reset-password');
    });
    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  );
}
```

Note: `supabase-js`'s `detectSessionInUrl: false` (Task 3) means the session from the deep link's URL fragment must be established explicitly. Because `expo-linking` delivers the full URL (including the `access_token`/`refresh_token` in the fragment) and `@supabase/supabase-js` v2's `onAuthStateChange` does not auto-parse a manually-passed URL on React Native, call `supabase.auth.setSession({ access_token, refresh_token })` using the tokens parsed out of the same URL before navigating — extend `parseAuthDeepLink`'s caller (not `parseAuthDeepLink` itself, which stays a pure classifier) to also extract those two tokens via `new URLSearchParams(fragment)` at the call site in `app/_layout.tsx`.

- [x] **Step 7: Manual verification**

Run: `npx expo start`, sign up with a real email, click the confirmation link.
Expected: the app opens via the `ascendo://` scheme and lands signed-in. **(Human-run — requires a real Supabase project with email confirmation enabled and a real inbox.)**

- [x] **Step 8: Commit**

```bash
git add src/lib/deep-link.ts src/lib/__tests__/deep-link.test.ts \
        "app/(auth)/sign-up.tsx" "app/(auth)/sign-up-confirm.tsx" app/_layout.tsx
git commit -m "feat(frontend): add sign-up flow with email confirmation deep link"
```

---

### Task 8: Log-in screen

**Files:**
- Create: `app/(auth)/log-in.tsx`

**Interfaces:**
- Consumes: `logInSchema` (Task 5), `supabase` (Task 3)

- [x] **Step 1: Write the screen**

`app/(auth)/log-in.tsx`:
```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { logInSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitError(null);
    const result = logInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.replace('/(app)');
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <TextField label="パスワード" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      {submitError ? <TextField label="" value={submitError} editable={false} error={submitError} /> : null}
      <PrimaryButton title="ログイン" onPress={handleSubmit} />
      <PrimaryButton title="パスワードをお忘れですか？" onPress={() => router.push('/(auth)/forgot-password')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
});
```

- [x] **Step 2: Manual verification**

Run: `npx expo start`, log in with a confirmed test account.
Expected: successful login navigates to `/(app)` (Task 10's guard then decides between plan-creation and the tabs). **(Human-run.)**

- [x] **Step 3: Commit**

```bash
git add "app/(auth)/log-in.tsx"
git commit -m "feat(frontend): add log-in screen"
```

---

### Task 9: Forgot-password + reset-password screens

**Files:**
- Create: `app/(auth)/forgot-password.tsx`, `app/(auth)/reset-password.tsx`

**Interfaces:**
- Consumes: `forgotPasswordSchema`, `resetPasswordSchema` (Task 5), `supabase` (Task 3)

- [x] **Step 1: Write `forgot-password.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { forgotPasswordSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '入力内容を確認してください');
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(result.data.email, {
      redirectTo: 'ascendo://reset-password',
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>リセット用メールを送信しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextField label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error ?? undefined} />
      <PrimaryButton title="リセットメールを送信" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  title: { ...typography.subheading, color: colors.text, textAlign: 'center' },
});
```

- [x] **Step 2: Write `reset-password.tsx`**

```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { resetPasswordSchema } from '../../src/features/auth/schemas';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const { error } = await supabase.auth.updateUser({ password: result.data.password });
    if (error) {
      setErrors({ password: error.message });
      return;
    }
    router.replace('/(app)');
  }

  return (
    <View style={styles.container}>
      <TextField label="新しいパスワード" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      <TextField label="新しいパスワード(確認)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} />
      <PrimaryButton title="パスワードを更新" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
});
```

- [x] **Step 3: Manual verification**

Run: `npx expo start`, use "パスワードをお忘れですか？" end to end with a real inbox.
Expected: reset email arrives, tapping its link opens `reset-password`, submitting a new password logs the user in. **(Human-run.)**

- [x] **Step 4: Commit**

```bash
git add "app/(auth)/forgot-password.tsx" "app/(auth)/reset-password.tsx"
git commit -m "feat(frontend): add forgot-password and reset-password screens"
```

---

### Task 10: Auth guard + PlanCheck layout

**Files:**
- Create: `src/features/auth/guard-logic.ts`
- Create: `app/(app)/_layout.tsx`
- Test: `src/features/auth/__tests__/guard-logic.test.ts`

**Interfaces:**
- Consumes: `AuthState` (Task 4)
- Produces: `determineRedirect(input: { auth: AuthState; hasActivePlan: boolean | null }): string | null` (`null` = render children as-is; a route string = redirect there; `hasActivePlan: null` means "still loading")

- [x] **Step 1: Write the failing test**

`src/features/auth/__tests__/guard-logic.test.ts`:
```ts
import { determineRedirect } from '../guard-logic';
import type { AuthState } from '../auth-reducer';

const SIGNED_OUT: AuthState = { status: 'signed-out' };
const LOADING: AuthState = { status: 'loading' };
const SIGNED_IN: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1' };

test('redirects to onboarding when signed out', () => {
  expect(determineRedirect({ auth: SIGNED_OUT, hasActivePlan: null })).toBe('/(auth)/onboarding');
});

test('renders nothing (still loading) while auth status is loading', () => {
  expect(determineRedirect({ auth: LOADING, hasActivePlan: null })).toBeNull();
});

test('renders nothing while signed in but the active-plan check is still loading', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: null })).toBeNull();
});

test('redirects to plan-creation when signed in with no active plan', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: false })).toBe('/(app)/plan-creation');
});

test('allows access (no redirect) when signed in with an active plan', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: true })).toBeNull();
});
```

Note: "renders nothing" here means "no redirect decision yet" (`null`), which the layout (Step 3) distinguishes from "signed in with a plan" by also checking `auth.status === 'loading' || hasActivePlan === null` before treating a `null` return as "show the tabs."

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../guard-logic'`

- [x] **Step 3: Implement `src/features/auth/guard-logic.ts`**

```ts
import type { AuthState } from './auth-reducer';

export function determineRedirect(input: { auth: AuthState; hasActivePlan: boolean | null }): string | null {
  if (input.auth.status === 'loading') return null;
  if (input.auth.status === 'signed-out') return '/(auth)/onboarding';
  if (input.hasActivePlan === null) return null;
  if (input.hasActivePlan === false) return '/(app)/plan-creation';
  return null;
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 5 new tests

- [x] **Step 5: Implement the layout**

`app/(app)/_layout.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Redirect, Slot } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/features/auth/AuthContext';
import { determineRedirect } from '../../src/features/auth/guard-logic';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const auth = useAuth();
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase
      .from('learning_plans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => setHasActivePlan((count ?? 0) > 0));
  }, [auth.status]);

  const redirect = determineRedirect({ auth, hasActivePlan });
  if (redirect) return <Redirect href={redirect as never} />;

  if (auth.status === 'loading' || (auth.status === 'signed-in' && hasActivePlan === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
```

- [x] **Step 6: Manual verification**

Run: `npx expo start`. Sign in with an account with no active plan → lands on `plan-creation` (not yet implemented until Task 13; a 404/blank is expected for now). Sign out → lands back on onboarding. **(Human-run.)**

- [x] **Step 7: Commit**

```bash
git add src/features/auth/guard-logic.ts src/features/auth/__tests__/guard-logic.test.ts "app/(app)/_layout.tsx"
git commit -m "feat(frontend): add auth guard + PlanCheck layout for (app) route group"
```

---

### Task 11: `LearningPlanJSON` types + phase-parsing helpers

**Files:**
- Create: `src/types/plan.ts`
- Create: `src/features/plan/plan-parsing.ts`
- Test: `src/features/plan/__tests__/plan-parsing.test.ts`

**Interfaces:**
- Produces: `LearningPlanJSON`, `LearningPhase`, `WeeklyTask`, `MonthlyTask`, `Milestone` (mirrors `backend/src/types.ts` and `data_model_design.md`§6, now with the full phase shape instead of `phases: unknown[]` — the frontend is exactly the consumer the backend's comment said would need it), `parsePlanJson(raw: unknown): LearningPlanJSON | null`, `computeOverallProgress(plan: LearningPlanJSON): number` (ratio 0-1, `completed monthly tasks / total monthly tasks` across all phases — the simplest well-defined MVP progress metric)

- [x] **Step 1: Write the failing test**

`src/features/plan/__tests__/plan-parsing.test.ts`:
```ts
import { parsePlanJson, computeOverallProgress } from '../plan-parsing';
import type { LearningPlanJSON } from '../../../types/plan';

const VALID_PLAN: LearningPlanJSON = {
  goal: 'TOEIC 500',
  currentLevel: 'beginner',
  weeklyAvailableHours: 5,
  contentGroupIds: [],
  phases: [
    {
      id: 'phase-1',
      name: 'Phase 1',
      startDate: '2026-08-01',
      endDate: '2026-12-01',
      weeklyTasks: [],
      monthlyTasks: [
        { id: 'm1', label: '文法診断テスト', month: '2026-08', done: true },
        { id: 'm2', label: '単語1000語', month: '2026-09', done: false },
      ],
      milestones: [],
    },
  ],
};

test('parsePlanJson accepts a well-formed plan', () => {
  expect(parsePlanJson(VALID_PLAN)).toEqual(VALID_PLAN);
});

test('parsePlanJson returns null for missing required fields', () => {
  expect(parsePlanJson({ goal: 'x' })).toBeNull();
});

test('parsePlanJson returns null for non-object input', () => {
  expect(parsePlanJson('not a plan')).toBeNull();
  expect(parsePlanJson(null)).toBeNull();
});

test('computeOverallProgress returns the ratio of completed monthly tasks', () => {
  expect(computeOverallProgress(VALID_PLAN)).toBe(0.5);
});

test('computeOverallProgress returns 0 when there are no monthly tasks at all', () => {
  const empty: LearningPlanJSON = { ...VALID_PLAN, phases: [{ ...VALID_PLAN.phases[0], monthlyTasks: [] }] };
  expect(computeOverallProgress(empty)).toBe(0);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../plan-parsing'`

- [x] **Step 3: Implement `src/types/plan.ts`**

```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WeeklyTask {
  id: string;
  label: string;
  contentGroupId?: string;
}

export interface MonthlyTask {
  id: string;
  label: string;
  month: string;
  done: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  targetValue: string;
  actualValue?: string;
}

export interface LearningPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
  milestones: Milestone[];
}

export interface LearningPlanJSON {
  goal: string;
  currentLevel: string;
  weeklyAvailableHours: number;
  phases: LearningPhase[];
  contentGroupIds: string[];
  conversationLog?: ChatMessage[];
}
```

- [x] **Step 4: Implement `src/features/plan/plan-parsing.ts`**

```ts
import type { LearningPlanJSON } from '../../types/plan';

const REQUIRED_FIELDS = ['goal', 'currentLevel', 'weeklyAvailableHours', 'phases', 'contentGroupIds'] as const;

export function parsePlanJson(raw: unknown): LearningPlanJSON | null {
  if (typeof raw !== 'object' || raw === null) return null;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in raw)) return null;
  }
  return raw as LearningPlanJSON;
}

export function computeOverallProgress(plan: LearningPlanJSON): number {
  const allMonthlyTasks = plan.phases.flatMap((phase) => phase.monthlyTasks);
  if (allMonthlyTasks.length === 0) return 0;
  const done = allMonthlyTasks.filter((task) => task.done).length;
  return done / allMonthlyTasks.length;
}
```

- [x] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS — 5 new tests

- [x] **Step 6: Commit**

```bash
git add src/types/plan.ts src/features/plan/plan-parsing.ts src/features/plan/__tests__/plan-parsing.test.ts
git commit -m "feat(frontend): add LearningPlanJSON types and phase-parsing/progress helpers"
```

---

### Task 12: Time-tracking hook

**Files:**
- Create: `src/features/study-timer/elapsed.ts`
- Create: `src/features/study-timer/useStudyTimer.ts`
- Test: `src/features/study-timer/__tests__/elapsed.test.ts`

**Interfaces:**
- Produces: `computeElapsedMinutes(startMs: number, endMs: number): number` (floored, non-negative), `useStudyTimer(learningPlanId: string): void` (React hook — call once per learning screen; starts a timer on mount, calls `increment_actual_minutes` on unmount/background via `AppState`)

- [x] **Step 1: Write the failing test for the pure math**

`src/features/study-timer/__tests__/elapsed.test.ts`:
```ts
import { computeElapsedMinutes } from '../elapsed';

test('computes whole minutes elapsed between two timestamps', () => {
  const start = Date.UTC(2026, 7, 11, 10, 0, 0);
  const end = Date.UTC(2026, 7, 11, 10, 5, 30);
  expect(computeElapsedMinutes(start, end)).toBe(5);
});

test('floors partial minutes down (does not round up)', () => {
  const start = Date.UTC(2026, 7, 11, 10, 0, 0);
  const end = Date.UTC(2026, 7, 11, 10, 0, 59);
  expect(computeElapsedMinutes(start, end)).toBe(0);
});

test('never returns a negative number, even if end is before start', () => {
  const start = Date.UTC(2026, 7, 11, 10, 5, 0);
  const end = Date.UTC(2026, 7, 11, 10, 0, 0);
  expect(computeElapsedMinutes(start, end)).toBe(0);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../elapsed'`

- [x] **Step 3: Implement `src/features/study-timer/elapsed.ts`**

```ts
export function computeElapsedMinutes(startMs: number, endMs: number): number {
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60_000);
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Implement the hook (runtime wiring, not unit-tested per Global Constraints — it directly touches `AppState` and `supabase.rpc`, which need the real Expo/React Native runtime)**

`src/features/study-timer/useStudyTimer.ts`:
```ts
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeElapsedMinutes } from './elapsed';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function flush(learningPlanId: string, startedAtMs: number) {
  const minutes = computeElapsedMinutes(startedAtMs, Date.now());
  if (minutes <= 0) return;
  await supabase.rpc('increment_actual_minutes', {
    p_learning_plan_id: learningPlanId,
    p_log_date: todayIsoDate(),
    p_minutes: minutes,
  });
}

/** Call once per learning screen (Vocab/Grammar/Listening), unconditionally — pass `null` while
 * the active learning_plan hasn't loaded yet; the hook itself no-ops until a real id is available.
 * (Calling this hook conditionally, e.g. `if (id) useStudyTimer(id)`, breaks React's Rules of
 * Hooks: the hook would be called on some renders and not others, changing call order — found
 * while executing Task 15, `npx tsc --noEmit` does not catch this since it's a runtime/lint rule,
 * not a type error.)
 * Tracks active time and flushes it to plan_day_logs.actual_minutes via increment_actual_minutes()
 * on unmount or app backgrounding. */
export function useStudyTimer(learningPlanId: string | null): void {
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!learningPlanId) return;
    startedAtRef.current = Date.now();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        flush(learningPlanId, startedAtRef.current);
        startedAtRef.current = Date.now();
      }
    });

    return () => {
      flush(learningPlanId, startedAtRef.current);
      subscription.remove();
    };
  }, [learningPlanId]);
}
```

- [x] **Step 6: Run full suite**

Run: `npm test`
Expected: PASS — no regressions

- [x] **Step 7: Commit**

```bash
git add src/features/study-timer
git commit -m "feat(frontend): add useStudyTimer (auto time tracking via increment_actual_minutes)"
```

---

### Task 13: `src/lib/api-client.ts` + Plan-creation (AI chat) screen

**Files:**
- Create: `src/lib/api-client.ts`
- Create: `src/features/plan-creation/chat-reducer.ts`
- Create: `app/(app)/plan-creation.tsx`
- Test: `src/lib/__tests__/api-client.test.ts`, `src/features/plan-creation/__tests__/chat-reducer.test.ts`

**Interfaces:**
- Produces: `callApi<T>(deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string }, path: string, init?: RequestInit): Promise<T>` (throws `ApiError` with `{ code, message }` from the `docs/api_design.md`§2 envelope on non-2xx), `chatReducer(state: ChatState, event: ChatEvent): ChatState` where `ChatState = { messages: ChatMessage[]; readyToGenerate: boolean }`

- [x] **Step 1: Write the failing test for `api-client.ts`**

`src/lib/__tests__/api-client.test.ts`:
```ts
import { callApi, ApiError } from '../api-client';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response) as typeof fetch;
}

test('callApi returns the parsed JSON body on success', async () => {
  const result = await callApi(
    { fetchFn: fakeFetch(200, { reply: 'hi', readyToGenerate: false }), baseUrl: 'http://x', accessToken: 'tok' },
    '/api/v1/plans/chat',
    { method: 'POST' },
  );
  expect(result).toEqual({ reply: 'hi', readyToGenerate: false });
});

test('callApi sends the Authorization header and joins baseUrl + path', async () => {
  let capturedUrl: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedHeaders = init.headers as Record<string, string>;
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  }) as typeof fetch;

  await callApi({ fetchFn, baseUrl: 'http://localhost:3000', accessToken: 'tok-123' }, '/api/v1/plans');

  expect(capturedUrl).toBe('http://localhost:3000/api/v1/plans');
  expect(capturedHeaders?.Authorization).toBe('Bearer tok-123');
});

test('callApi throws ApiError with the code/message from the error envelope on failure', async () => {
  await expect(
    callApi(
      { fetchFn: fakeFetch(403, { error: { code: 'FREE_QUOTA_EXHAUSTED', message: 'no quota left' } }), baseUrl: 'http://x', accessToken: 'tok' },
      '/api/v1/plans',
    ),
  ).rejects.toThrow(ApiError);

  try {
    await callApi(
      { fetchFn: fakeFetch(403, { error: { code: 'FREE_QUOTA_EXHAUSTED', message: 'no quota left' } }), baseUrl: 'http://x', accessToken: 'tok' },
      '/api/v1/plans',
    );
  } catch (err) {
    expect((err as ApiError).code).toBe('FREE_QUOTA_EXHAUSTED');
    expect((err as ApiError).message).toBe('no quota left');
  }
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api-client'`

- [x] **Step 3: Implement `src/lib/api-client.ts`**

```ts
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function callApi<T>(
  deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string },
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await deps.fetchFn(`${deps.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deps.accessToken}`,
      ...init.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Request failed');
  }

  return body as T;
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Write the failing test for `chat-reducer.ts`**

`src/features/plan-creation/__tests__/chat-reducer.test.ts`:
```ts
import { chatReducer, type ChatState } from '../chat-reducer';

const EMPTY: ChatState = { messages: [], readyToGenerate: false };

test('USER_MESSAGE appends a user message', () => {
  const next = chatReducer(EMPTY, { type: 'USER_MESSAGE', content: 'Hello' });
  expect(next.messages).toEqual([{ role: 'user', content: 'Hello' }]);
});

test('AI_REPLY appends an assistant message and sets readyToGenerate', () => {
  const next = chatReducer(EMPTY, { type: 'AI_REPLY', content: 'What is your goal?', readyToGenerate: true });
  expect(next.messages).toEqual([{ role: 'assistant', content: 'What is your goal?' }]);
  expect(next.readyToGenerate).toBe(true);
});

test('messages accumulate across multiple dispatches', () => {
  let state = chatReducer(EMPTY, { type: 'USER_MESSAGE', content: 'Hi' });
  state = chatReducer(state, { type: 'AI_REPLY', content: 'Hello! What is your goal?', readyToGenerate: false });
  state = chatReducer(state, { type: 'USER_MESSAGE', content: 'TOEIC 500' });
  expect(state.messages).toHaveLength(3);
});
```

- [x] **Step 6: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../chat-reducer'`

- [x] **Step 7: Implement `src/features/plan-creation/chat-reducer.ts`**

```ts
import type { ChatMessage } from '../../types/plan';

export interface ChatState {
  messages: ChatMessage[];
  readyToGenerate: boolean;
}

export type ChatEvent =
  | { type: 'USER_MESSAGE'; content: string }
  | { type: 'AI_REPLY'; content: string; readyToGenerate: boolean };

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'USER_MESSAGE':
      return { ...state, messages: [...state.messages, { role: 'user', content: event.content }] };
    case 'AI_REPLY':
      return {
        messages: [...state.messages, { role: 'assistant', content: event.content }],
        readyToGenerate: event.readyToGenerate,
      };
  }
}
```

- [x] **Step 8: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 9: Write the screen**

`app/(app)/plan-creation.tsx`:
```tsx
import { useReducer, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { callApi, ApiError } from '../../src/lib/api-client';
import { chatReducer } from '../../src/features/plan-creation/chat-reducer';
import { useAuth } from '../../src/features/auth/AuthContext';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

export default function PlanCreation() {
  const auth = useAuth();
  const [state, dispatch] = useReducer(chatReducer, { messages: [], readyToGenerate: false });
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (auth.status !== 'signed-in') return null;

  async function sendMessage() {
    if (auth.status !== 'signed-in' || !input.trim()) return;
    const content = input;
    setInput('');
    dispatch({ type: 'USER_MESSAGE', content });

    try {
      const result = await callApi<{ reply: string; readyToGenerate: boolean }>(
        { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
        '/api/v1/plans/chat',
        { method: 'POST', body: JSON.stringify({ targetLang: 'en', messages: [...state.messages, { role: 'user', content }] }) },
      );
      dispatch({ type: 'AI_REPLY', content: result.reply, readyToGenerate: result.readyToGenerate });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    }
  }

  async function generatePlan() {
    if (auth.status !== 'signed-in') return;
    try {
      await callApi(
        { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
        '/api/v1/plans',
        { method: 'POST', body: JSON.stringify({ targetLang: 'en', messages: state.messages }) },
      );
      router.replace('/(app)');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FREE_QUOTA_EXHAUSTED') {
        router.replace('/(app)/upgrade-info');
        return;
      }
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messages}>
        {state.messages.map((m, i) => (
          <Text key={i} style={m.role === 'user' ? styles.userBubble : styles.aiBubble}>{m.content}</Text>
        ))}
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
      {state.readyToGenerate ? (
        <PrimaryButton title="学習計画を作成する" onPress={generatePlan} />
      ) : (
        <>
          <TextField label="" value={input} onChangeText={setInput} placeholder="メッセージを入力" />
          <PrimaryButton title="送信" onPress={sendMessage} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  messages: { flex: 1, marginBottom: spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, color: '#fff', borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, color: colors.text, borderRadius: 12, padding: spacing.sm, marginVertical: spacing.xs },
});
```

- [x] **Step 10: Manual verification**

Run: `npx expo start` with `backend/` running locally (`npm start` in `backend/`, `API_BASE_URL` pointing at it). Have a chat conversation, confirm the "学習計画を作成する" button appears once the backend signals `readyToGenerate: true`, and that tapping it creates a plan and returns to `/(app)`. **(Human-run — requires both the Expo app and the backend running simultaneously.)**

- [x] **Step 11: Commit**

```bash
git add src/lib/api-client.ts src/lib/__tests__/api-client.test.ts \
        src/features/plan-creation "app/(app)/plan-creation.tsx"
git commit -m "feat(frontend): add api-client and AI chat plan-creation screen"
```

---

### Task 14: Home/Dashboard screen

**Files:**
- Create: `src/features/home/weekly-summary.ts`
- Create: `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/index.tsx`
- Test: `src/features/home/__tests__/weekly-summary.test.ts`

**Interfaces:**
- Consumes: `LearningPlanJSON`, `computeOverallProgress` (Task 11), `formatMinutes`, `formatPercent` (Task 2), `ProgressBar`, `Card` (Task 2)
- Produces: `computeWeeklySummary(dayLogs: { actual_minutes: number }[], weekLog: { plan_hours: number } | null): { actualMinutes: number; plannedMinutes: number }`

- [x] **Step 1: Write the failing test**

`src/features/home/__tests__/weekly-summary.test.ts`:
```ts
import { computeWeeklySummary } from '../weekly-summary';

test('sums actual_minutes across the week\'s day logs', () => {
  const result = computeWeeklySummary(
    [{ actual_minutes: 30 }, { actual_minutes: 45 }, { actual_minutes: 0 }],
    { plan_hours: 5 },
  );
  expect(result).toEqual({ actualMinutes: 75, plannedMinutes: 300 });
});

test('returns plannedMinutes 0 when there is no week log yet', () => {
  const result = computeWeeklySummary([{ actual_minutes: 20 }], null);
  expect(result).toEqual({ actualMinutes: 20, plannedMinutes: 0 });
});

test('returns zeros for an empty week', () => {
  expect(computeWeeklySummary([], null)).toEqual({ actualMinutes: 0, plannedMinutes: 0 });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../weekly-summary'`

- [x] **Step 3: Implement `src/features/home/weekly-summary.ts`**

```ts
export function computeWeeklySummary(
  dayLogs: { actual_minutes: number }[],
  weekLog: { plan_hours: number } | null,
): { actualMinutes: number; plannedMinutes: number } {
  const actualMinutes = dayLogs.reduce((sum, log) => sum + log.actual_minutes, 0);
  const plannedMinutes = weekLog ? weekLog.plan_hours * 60 : 0;
  return { actualMinutes, plannedMinutes };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Tab layout**

`app/(app)/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
import { colors } from '../../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="vocab" options={{ title: '単語' }} />
      <Tabs.Screen name="grammar" options={{ title: '文法' }} />
      <Tabs.Screen name="listening" options={{ title: 'リスニング' }} />
      <Tabs.Screen name="records" options={{ title: '実績' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}
```

- [x] **Step 6: Home screen**

`app/(app)/(tabs)/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { parsePlanJson, computeOverallProgress } from '../../../src/features/plan/plan-parsing';
import { computeWeeklySummary } from '../../../src/features/home/weekly-summary';
import { formatMinutes, formatPercent } from '../../../src/lib/format';
import { Card } from '../../../src/components/Card';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';
import type { LearningPlanJSON } from '../../../src/types/plan';

export default function Home() {
  const [plan, setPlan] = useState<LearningPlanJSON | null>(null);
  const [weekly, setWeekly] = useState({ actualMinutes: 0, plannedMinutes: 0 });

  useEffect(() => {
    supabase
      .from('learning_plans')
      .select('plan_json')
      .eq('status', 'active')
      .single()
      .then(({ data }) => setPlan(data ? parsePlanJson(data.plan_json) : null));
  }, []);

  useEffect(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    supabase
      .from('plan_day_logs')
      .select('actual_minutes')
      .gte('log_date', weekStartIso)
      .then(({ data }) => setWeekly(computeWeeklySummary(data ?? [], null)));
  }, []);

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  const progress = computeOverallProgress(plan);

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Text style={typography.heading}>{plan.goal}</Text>
        <ProgressBar ratio={progress} />
        <Text style={styles.caption}>全体進捗 {formatPercent(progress)}</Text>
        <Text style={styles.caption}>今週の実績 {formatMinutes(weekly.actualMinutes)}</Text>
      </Card>

      {plan.phases.map((phase) => (
        <Card key={phase.id} style={{ marginTop: spacing.md }}>
          <Text style={typography.subheading}>{phase.name}</Text>
          {phase.weeklyTasks.map((task) => (
            <Text key={task.id} style={styles.taskRow}>・{task.label}</Text>
          ))}
          {phase.monthlyTasks.map((task) => (
            <Text key={task.id} style={styles.taskRow}>{task.done ? '☑' : '☐'} {task.label}</Text>
          ))}
          {phase.milestones.map((m) => (
            <Text key={m.id} style={styles.taskRow}>{m.label}: {m.actualValue ?? '-'} / {m.targetValue}</Text>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  taskRow: { ...typography.body, color: colors.text, marginTop: spacing.xs },
});
```

- [x] **Step 7: Manual verification**

Run: `npx expo start`, sign in with an account that has an active plan.
Expected: header shows goal/progress/weekly time, phases render as cards with their tasks/milestones. **(Human-run.)**

- [x] **Step 8: Commit**

```bash
git add src/features/home "app/(app)/(tabs)/_layout.tsx" "app/(app)/(tabs)/index.tsx"
git commit -m "feat(frontend): add Home/Dashboard screen with full phase plan + weekly summary"
```

---

### Task 15: Vocab screen (Leitner spaced repetition)

**Files:**
- Create: `src/features/vocab/leitner.ts`
- Create: `app/(app)/(tabs)/vocab.tsx`
- Test: `src/features/vocab/__tests__/leitner.test.ts`

**Interfaces:**
- Produces: `nextCycle(currentCycle: number, wasCorrect: boolean): number`, `pickNextWords(progress: Map<string, number>, allWordIds: string[], count: number): string[]` (lowest-cycle-first; words with no progress entry are treated as cycle 0, i.e. highest priority)

- [x] **Step 1: Write the failing test**

`src/features/vocab/__tests__/leitner.test.ts`:
```ts
import { nextCycle, pickNextWords } from '../leitner';

test('nextCycle increments on a correct answer', () => {
  expect(nextCycle(2, true)).toBe(3);
});

test('nextCycle resets to 0 on an incorrect answer', () => {
  expect(nextCycle(4, false)).toBe(0);
});

test('nextCycle never goes below 0', () => {
  expect(nextCycle(0, false)).toBe(0);
});

test('pickNextWords prioritizes lower-cycle words first', () => {
  const progress = new Map([
    ['w1', 3],
    ['w2', 0],
    ['w3', 1],
  ]);
  const result = pickNextWords(progress, ['w1', 'w2', 'w3'], 2);
  expect(result).toEqual(['w2', 'w3']);
});

test('pickNextWords treats words with no progress entry as cycle 0 (highest priority)', () => {
  const progress = new Map([['w1', 5]]);
  const result = pickNextWords(progress, ['w1', 'w2'], 1);
  expect(result).toEqual(['w2']);
});

test('pickNextWords returns fewer than count if there are not enough words', () => {
  const result = pickNextWords(new Map(), ['w1'], 5);
  expect(result).toEqual(['w1']);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../leitner'`

- [x] **Step 3: Implement `src/features/vocab/leitner.ts`**

```ts
export function nextCycle(currentCycle: number, wasCorrect: boolean): number {
  if (!wasCorrect) return 0;
  return currentCycle + 1;
}

export function pickNextWords(progress: Map<string, number>, allWordIds: string[], count: number): string[] {
  return [...allWordIds]
    .sort((a, b) => (progress.get(a) ?? 0) - (progress.get(b) ?? 0))
    .slice(0, count);
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 6 new tests

- [x] **Step 5: Write the screen**

`app/(app)/(tabs)/vocab.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { nextCycle, pickNextWords } from '../../../src/features/vocab/leitner';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { Card } from '../../../src/components/Card';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface VocabWord {
  content_id: string;
  target_text: string;
  target_phonetic: string | null;
  native_text: string;
}

export default function Vocab() {
  const auth = useAuth();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;

    supabase.from('learning_plans').select('id').eq('status', 'active').single().then(({ data }) => {
      if (data) setLearningPlanId(data.id);
    });

    Promise.all([
      supabase.from('vocabulary_items').select('content_id, target_text, target_phonetic, native_text'),
      supabase.from('user_vocabulary_progress').select('content_id, cycle').eq('profile_id', auth.userId),
    ]).then(([wordsRes, progressRes]) => {
      const allWords = (wordsRes.data ?? []) as VocabWord[];
      const progressMap = new Map((progressRes.data ?? []).map((p) => [p.content_id, p.cycle]));
      const nextIds = pickNextWords(progressMap, allWords.map((w) => w.content_id), 10);
      setWords(allWords.filter((w) => nextIds.includes(w.content_id)));
    });
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = words[index];

  async function answer(correct: boolean) {
    if (!current || auth.status !== 'signed-in') return;

    const { data: existing } = await supabase
      .from('user_vocabulary_progress')
      .select('cycle')
      .eq('profile_id', auth.userId)
      .eq('content_id', current.content_id)
      .maybeSingle();

    const cycle = nextCycle(existing?.cycle ?? 0, correct);
    await supabase.from('user_vocabulary_progress').upsert({
      profile_id: auth.userId,
      content_id: current.content_id,
      cycle,
      memorized_at: correct ? new Date().toISOString() : null,
    });
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: correct,
    });

    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>今日の単語学習は完了しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <Pressable onPress={() => setRevealed((r) => !r)}>
          <Text style={typography.heading}>{current.target_text}</Text>
          {current.target_phonetic ? <Text style={styles.caption}>{current.target_phonetic}</Text> : null}
          {revealed ? <Text style={[typography.subheading, { marginTop: spacing.md }]}>{current.native_text}</Text> : null}
        </Pressable>
      </Card>
      {revealed ? (
        <View style={styles.row}>
          <PrimaryButton title="わからなかった" onPress={() => answer(false)} />
          <PrimaryButton title="覚えていた" onPress={() => answer(true)} />
        </View>
      ) : (
        <PrimaryButton title="タップして答えを見る" onPress={() => setRevealed(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.md },
});
```

- [x] **Step 6: Manual verification**

Run: `npx expo start`, work through several vocab cards, confirm cycle progresses on "覚えていた" and resets on "わからなかった" (check `user_vocabulary_progress` in the Supabase dashboard). **(Human-run.)**

- [x] **Step 7: Commit**

```bash
git add src/features/vocab "app/(app)/(tabs)/vocab.tsx"
git commit -m "feat(frontend): add Vocab screen with Leitner spaced repetition"
```

---

### Task 16: Grammar screen

**Files:**
- Create: `src/features/grammar/scoring.ts`
- Create: `app/(app)/(tabs)/grammar.tsx`
- Test: `src/features/grammar/__tests__/scoring.test.ts`

**Interfaces:**
- Produces: `isCorrectChoice(correctAnswer: string, selected: string): boolean` (trims whitespace, exact match — the full grading logic; kept as a named function rather than an inline `===` because a future partial-credit rule would only need to change here)

- [x] **Step 1: Write the failing test**

`src/features/grammar/__tests__/scoring.test.ts`:
```ts
import { isCorrectChoice } from '../scoring';

test('matches when selected equals the correct answer exactly', () => {
  expect(isCorrectChoice('am', 'am')).toBe(true);
});

test('does not match a different choice', () => {
  expect(isCorrectChoice('am', 'is')).toBe(false);
});

test('trims incidental whitespace before comparing', () => {
  expect(isCorrectChoice('am', ' am ')).toBe(true);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scoring'`

- [x] **Step 3: Implement `src/features/grammar/scoring.ts`**

```ts
export function isCorrectChoice(correctAnswer: string, selected: string): boolean {
  return correctAnswer.trim() === selected.trim();
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Write the screen**

`app/(app)/(tabs)/grammar.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { isCorrectChoice } from '../../../src/features/grammar/scoring';
import { Card } from '../../../src/components/Card';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface GrammarQuestion {
  content_id: string;
  question: string;
  choices: string[];
  answer: string;
  explanation: string | null;
}

export default function Grammar() {
  const auth = useAuth();
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase.from('learning_plans').select('id').eq('status', 'active').single().then(({ data }) => {
      if (data) setLearningPlanId(data.id);
    });
    supabase.from('grammar_items').select('content_id, question, choices, answer, explanation').then(({ data }) => {
      setQuestions((data ?? []) as GrammarQuestion[]);
    });
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = questions[index];

  async function selectChoice(choice: string) {
    if (!current || selected || auth.status !== 'signed-in') return;
    setSelected(choice);
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: isCorrectChoice(current.answer, choice),
    });
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>文法問題は以上です</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <Text style={typography.subheading}>{current.question}</Text>
        {current.choices.map((choice) => (
          <Pressable
            key={choice}
            onPress={() => selectChoice(choice)}
            style={[
              styles.choice,
              selected === choice && (isCorrectChoice(current.answer, choice) ? styles.correct : styles.incorrect),
            ]}
          >
            <Text>{choice}</Text>
          </Pressable>
        ))}
        {selected && current.explanation ? <Text style={styles.caption}>{current.explanation}</Text> : null}
      </Card>
      {selected ? (
        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={{ color: colors.primary }}>次へ</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm },
  correct: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  incorrect: { borderColor: colors.danger },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  nextButton: { alignItems: 'center', marginTop: spacing.md },
});
```

- [x] **Step 6: Manual verification**

Run: `npx expo start`, answer a few grammar questions, confirm correct/incorrect styling and that `learning_records` rows appear in Supabase. **(Human-run.)**

- [x] **Step 7: Commit**

```bash
git add src/features/grammar "app/(app)/(tabs)/grammar.tsx"
git commit -m "feat(frontend): add Grammar screen"
```

---

### Task 17: Listening screen

**Files:**
- Create: `app/(app)/(tabs)/listening.tsx`

**Interfaces:**
- Consumes: `useStudyTimer` (Task 12), `expo-av`'s `Audio.Sound`

- [x] **Step 1: Write the screen**

`app/(app)/(tabs)/listening.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useStudyTimer } from '../../../src/features/study-timer/useStudyTimer';
import { isCorrectChoice } from '../../../src/features/grammar/scoring';
import { Card } from '../../../src/components/Card';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface ListeningQuestion {
  content_id: string;
  question: string;
  choices: string[];
  answer: string;
  listening_passages: { audio_url: string | null };
}

export default function Listening() {
  const auth = useAuth();
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [learningPlanId, setLearningPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase.from('learning_plans').select('id').eq('status', 'active').single().then(({ data }) => {
      if (data) setLearningPlanId(data.id);
    });
    supabase
      .from('listening_items')
      .select('content_id, question, choices, answer, listening_passages(audio_url)')
      .then(({ data }) => setQuestions((data ?? []) as unknown as ListeningQuestion[]));
  }, [auth.status]);

  useStudyTimer(learningPlanId);

  const current = questions[index];

  async function playAudio() {
    if (!current?.listening_passages.audio_url) return;
    const { sound } = await Audio.Sound.createAsync({ uri: current.listening_passages.audio_url });
    await sound.playAsync();
  }

  async function selectChoice(choice: string) {
    if (!current || selected || auth.status !== 'signed-in') return;
    setSelected(choice);
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: current.content_id,
      is_correct: isCorrectChoice(current.answer, choice),
    });
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text>リスニング問題は以上です</Text>
      </View>
    );
  }

  if (!current.listening_passages.audio_url) {
    return (
      <View style={styles.center}>
        <Text>音源準備中です。しばらくお待ちください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <PrimaryButton title="再生する" onPress={playAudio} />
        <Text style={[typography.subheading, { marginTop: spacing.md }]}>{current.question}</Text>
        {current.choices.map((choice) => (
          <Pressable key={choice} onPress={() => selectChoice(choice)} style={styles.choice}>
            <Text>{choice}</Text>
          </Pressable>
        ))}
      </Card>
      {selected ? (
        <Pressable style={styles.nextButton} onPress={() => { setSelected(null); setIndex((i) => i + 1); }}>
          <Text style={{ color: colors.primary }}>次へ</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm },
  nextButton: { alignItems: 'center', marginTop: spacing.md },
});
```

- [x] **Step 2: Manual verification**

Run: `npx expo start`, play a listening passage's audio and answer its question. If no `listening_items` have a generated `audio_url` yet, confirm the "準備中" state renders instead. **(Human-run.)**

- [x] **Step 3: Commit**

```bash
git add "app/(app)/(tabs)/listening.tsx"
git commit -m "feat(frontend): add Listening screen"
```

---

### Task 18: Assessment (test) flow

**Files:**
- Create: `src/features/assessment/scoring.ts`
- Create: `src/features/assessment/AssessmentRunner.tsx`
- Test: `src/features/assessment/__tests__/scoring.test.ts`

**Interfaces:**
- Produces: `computeScore(records: { is_correct: boolean }[]): { correct: number; total: number; percent: number }`, `<AssessmentRunner sourceGroupIds={string[]} onFinished={() => void} />` (mountable from any of the three learning screens' "テストする" button — not wired into a route of its own, per `frontend_design.md`§9's "共通" framing)

- [x] **Step 1: Write the failing test**

`src/features/assessment/__tests__/scoring.test.ts`:
```ts
import { computeScore } from '../scoring';

test('computes correct/total/percent from a list of records', () => {
  const result = computeScore([{ is_correct: true }, { is_correct: true }, { is_correct: false }, { is_correct: true }]);
  expect(result).toEqual({ correct: 3, total: 4, percent: 75 });
});

test('returns percent 0 for an empty record list (avoids division by zero)', () => {
  expect(computeScore([])).toEqual({ correct: 0, total: 0, percent: 0 });
});

test('rounds percent to the nearest whole number', () => {
  const result = computeScore([{ is_correct: true }, { is_correct: false }, { is_correct: false }]);
  expect(result.percent).toBe(33);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scoring'`

- [x] **Step 3: Implement `src/features/assessment/scoring.ts`**

```ts
export function computeScore(records: { is_correct: boolean }[]): { correct: number; total: number; percent: number } {
  const total = records.length;
  const correct = records.filter((r) => r.is_correct).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Write the shared component**

`src/features/assessment/AssessmentRunner.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { callApi } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import { isCorrectChoice } from '../grammar/scoring';
import { computeScore } from './scoring';
import { Card } from '../../components/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

interface AssessmentItem {
  position: number;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'listening' | 'shadowing';
}

export function AssessmentRunner({ sourceGroupIds, onFinished }: { sourceGroupIds: string[]; onFinished: () => void }) {
  const auth = useAuth();
  const [testId, setTestId] = useState<string | null>(null);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<{ is_correct: boolean }[]>([]);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    callApi<{ id: string; items: AssessmentItem[] }>(
      { fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken },
      '/api/v1/assessments',
      { method: 'POST', body: JSON.stringify({ sourceGroupIds, itemCount: 5 }) },
    ).then((result) => {
      setTestId(result.id);
      setItems(result.items);
    });
  }, [auth.status]);

  async function grade(correct: boolean) {
    if (auth.status !== 'signed-in' || !testId) return;
    const item = items[index];
    await supabase.from('learning_records').insert({
      profile_id: auth.userId,
      content_id: item.contentId,
      test_id: testId,
      is_correct: correct,
    });
    const nextRecords = [...records, { is_correct: correct }];
    setRecords(nextRecords);

    if (index + 1 >= items.length) {
      onFinished();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!testId || items.length === 0) {
    return (
      <View style={styles.center}>
        <Text>テストを準備しています...</Text>
      </View>
    );
  }

  const score = computeScore(records);

  return (
    <Card>
      <Text style={typography.subheading}>問題 {index + 1} / {items.length}</Text>
      <Text style={styles.caption}>現在のスコア: {score.correct} / {score.total}({score.percent}%)</Text>
      <View style={styles.row}>
        <Pressable style={styles.choiceButton} onPress={() => grade(false)}><Text>不正解として記録</Text></Pressable>
        <Pressable style={styles.choiceButton} onPress={() => grade(true)}><Text>正解として記録</Text></Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  choiceButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, flex: 1, alignItems: 'center' },
});
```

Note: `AssessmentRunner` intentionally exposes generic "正解/不正解として記録" grading buttons rather than re-rendering each content type's own choice UI — per-content-type test rendering (showing the actual vocab card / grammar choices / listening audio inside a test) is deferred; wiring `AssessmentRunner` into each of the three learning screens' "テストする" button is listed in §19 below as a follow-up, not part of this task's Step 6 commit.

- [x] **Step 6: Commit**

```bash
git add src/features/assessment
git commit -m "feat(frontend): add AssessmentRunner and score computation"
```

---

### Task 19: Records screen

**Files:**
- Create: `src/features/records/aggregate.ts`
- Create: `app/(app)/(tabs)/records.tsx`
- Test: `src/features/records/__tests__/aggregate.test.ts`

**Interfaces:**
- Produces: `aggregateAccuracyByDate(records: { answered_at: string; is_correct: boolean }[]): { date: string; accuracyPercent: number }[]` (grouped by the date portion of `answered_at`, sorted ascending)

- [x] **Step 1: Write the failing test**

`src/features/records/__tests__/aggregate.test.ts`:
```ts
import { aggregateAccuracyByDate } from '../aggregate';

test('groups records by date and computes per-day accuracy percent', () => {
  const result = aggregateAccuracyByDate([
    { answered_at: '2026-08-10T09:00:00Z', is_correct: true },
    { answered_at: '2026-08-10T10:00:00Z', is_correct: false },
    { answered_at: '2026-08-11T09:00:00Z', is_correct: true },
  ]);
  expect(result).toEqual([
    { date: '2026-08-10', accuracyPercent: 50 },
    { date: '2026-08-11', accuracyPercent: 100 },
  ]);
});

test('returns an empty array for no records', () => {
  expect(aggregateAccuracyByDate([])).toEqual([]);
});

test('sorts output dates ascending regardless of input order', () => {
  const result = aggregateAccuracyByDate([
    { answered_at: '2026-08-12T09:00:00Z', is_correct: true },
    { answered_at: '2026-08-10T09:00:00Z', is_correct: true },
  ]);
  expect(result.map((r) => r.date)).toEqual(['2026-08-10', '2026-08-12']);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../aggregate'`

- [x] **Step 3: Implement `src/features/records/aggregate.ts`**

```ts
export function aggregateAccuracyByDate(
  records: { answered_at: string; is_correct: boolean }[],
): { date: string; accuracyPercent: number }[] {
  const byDate = new Map<string, { correct: number; total: number }>();

  for (const record of records) {
    const date = record.answered_at.slice(0, 10);
    const bucket = byDate.get(date) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (record.is_correct) bucket.correct += 1;
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { correct, total }]) => ({ date, accuracyPercent: Math.round((correct / total) * 100) }));
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests

- [x] **Step 5: Write the screen**

`app/(app)/(tabs)/records.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { aggregateAccuracyByDate } from '../../../src/features/records/aggregate';
import { formatPercent } from '../../../src/lib/format';
import { Card } from '../../../src/components/Card';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

export default function Records() {
  const auth = useAuth();
  const [trend, setTrend] = useState<{ date: string; accuracyPercent: number }[]>([]);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    supabase
      .from('learning_records')
      .select('answered_at, is_correct')
      .eq('profile_id', auth.userId)
      .order('answered_at', { ascending: true })
      .then(({ data }) => setTrend(aggregateAccuracyByDate(data ?? [])));
  }, [auth.status]);

  return (
    <ScrollView style={styles.container}>
      <Text style={typography.heading}>学習実績</Text>
      {trend.map((day) => (
        <Card key={day.date} style={{ marginTop: spacing.sm }}>
          <Text style={typography.body}>{day.date}</Text>
          <ProgressBar ratio={day.accuracyPercent / 100} />
          <Text style={styles.caption}>正答率 {formatPercent(day.accuracyPercent / 100)}</Text>
        </Card>
      ))}
      {trend.length === 0 ? <Text style={styles.caption}>まだ学習記録がありません</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
```

- [x] **Step 6: Manual verification**

Run: `npx expo start` after answering some vocab/grammar questions, open the Records tab.
Expected: one card per day with an accuracy bar. **(Human-run.)**

- [x] **Step 7: Commit**

```bash
git add src/features/records "app/(app)/(tabs)/records.tsx"
git commit -m "feat(frontend): add Records screen with accuracy trend"
```

---

### Task 20: Settings + Upgrade-info screens

**Files:**
- Create: `src/features/settings/delete-account.ts`
- Create: `app/(app)/(tabs)/settings.tsx`, `app/(app)/upgrade-info.tsx`
- Test: `src/features/settings/__tests__/delete-account.test.ts`

**Interfaces:**
- Produces: `deleteAccount(deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string }): Promise<void>` (thin wrapper over `callApi`, kept separate so the confirmation-dialog UI in the screen has one thing to call)

- [x] **Step 1: Write the failing test**

`src/features/settings/__tests__/delete-account.test.ts`:
```ts
import { deleteAccount } from '../delete-account';

test('deleteAccount calls DELETE /api/v1/identity/me with confirmation: "DELETE"', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, status: 204, json: async () => ({}) } as Response;
  }) as typeof fetch;

  await deleteAccount({ fetchFn, baseUrl: 'http://x', accessToken: 'tok' });

  expect(capturedUrl).toBe('http://x/api/v1/identity/me');
  expect(capturedInit?.method).toBe('DELETE');
  expect(JSON.parse(capturedInit?.body as string)).toEqual({ confirmation: 'DELETE' });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../delete-account'`

- [x] **Step 3: Implement `src/features/settings/delete-account.ts`**

```ts
import { callApi } from '../../lib/api-client';

export async function deleteAccount(deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string }): Promise<void> {
  await callApi(deps, '/api/v1/identity/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 1 new test

- [x] **Step 5: Write the screens**

`app/(app)/(tabs)/settings.tsx`:
```tsx
import { Alert, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { deleteAccount } from '../../../src/features/settings/delete-account';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

const { apiBaseUrl } = Constants.expoConfig?.extra ?? {};

export default function Settings() {
  const auth = useAuth();
  if (auth.status !== 'signed-in') return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/onboarding');
  }

  function handleDeleteAccount() {
    Alert.alert('退会しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退会する',
        style: 'destructive',
        onPress: async () => {
          if (auth.status !== 'signed-in') return;
          await deleteAccount({ fetchFn: fetch, baseUrl: apiBaseUrl as string, accessToken: auth.accessToken });
          router.replace('/(auth)/onboarding');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={typography.heading}>設定</Text>
      <PrimaryButton title="ログアウト" onPress={handleLogout} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton title="退会する" onPress={handleDeleteAccount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
});
```

`app/(app)/upgrade-info.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function UpgradeInfo() {
  return (
    <View style={styles.container}>
      <Text style={typography.subheading}>AI学習計画の無料枠を使い切りました</Text>
      <Text style={styles.body}>有料プラン(Phase 2で提供予定)にご期待ください。それまでは単語・文法・リスニングの学習コンテンツは引き続き無料でご利用いただけます。</Text>
      <PrimaryButton title="ホームに戻る" onPress={() => router.replace('/(app)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  body: { ...typography.body, color: colors.textMuted, marginVertical: spacing.lg, textAlign: 'center' },
});
```

- [x] **Step 6: Manual verification**

Run: `npx expo start`. Confirm logout returns to onboarding, and that the "退会する" confirmation dialog calls the backend and signs the user out. Trigger `upgrade-info` by exhausting the free quota (or by direct navigation during testing). **(Human-run — account deletion is destructive, verify against a disposable test account only.)**

- [x] **Step 7: Commit**

```bash
git add src/features/settings "app/(app)/(tabs)/settings.tsx" "app/(app)/upgrade-info.tsx"
git commit -m "feat(frontend): add Settings and Upgrade-info screens"
```

---

## 完了後の状態

全11画面が実装され、`npm test`が純粋ロジック(Leitner算出、時間計測、フォームバリデーション、認証ガード判定、スコア集計等)を自動検証する。画面自体の見た目・実機動作は`npx expo start`での目視確認が必要(Global Constraints参照)。

### 追加: Google/Apple OAuthログイン(計画外、2026-08-16追加)

`frontend_design.md`には含まれていなかったが、ユーザー要望により追加。`signup-or-login.tsx`に「Googleでログイン」「Appleでログイン」ボタンを追加し、`src/features/auth/oauth.ts`(`signInWithOAuth` + `expo-web-browser`でのブラウザ経由フロー、確認メールのディープリンクと同じ「URLからトークン抽出→`setSession`」パターンを再利用)で実装。コールバックURL解析部分(`parseOAuthCallbackUrl`)は`src/features/auth/oauth-callback.ts`に分離し、Jestで単体テスト(5件)。

**この機能を実際に使うには、Supabaseダッシュボード側でGoogle/AppleのOAuthプロバイダを有効化する外部設定(Google Cloud ConsoleでのOAuthクライアント作成、Apple Developer Program登録+Services ID設定)が別途必要**。実装者ではなくプロジェクトオーナーが認証情報を扱う都合上、コード実装のみ完了し外部設定は未実施。

## 未着手・今後の検討事項

- **`AssessmentRunner`の配線が未完了**: Task 18でコンポーネントは作成したが、Vocab/Grammar/Listening画面の「テストする」ボタンからは呼び出していない。理由: 現在の3画面は`content_group_id`でグルーピングせず全件取得しているため、`POST /assessments`が要求する`sourceGroupIds`をどの単位で選ばせるか(単語帳ごと？文法トピックごと？)がUXとして未設計。`frontend_design.md`に立ち返って「コンテンツグループの選択画面」を追加設計する必要がある
- **`MonthlyTask.done`のバックエンド側不整合**: Home画面(Task 14)は月次タスクにチェックボックス(`done: boolean`)を表示する設計にしたが、`backend/src/shared/ai-adapter.ts`の`generatePlan()`のプロンプトはこのフィールドを生成するよう指示していない(`backend_implementation_plan.md`作成時点では`phases: unknown[]`として不透明に扱われていたため気づかれなかった)。また、チェック操作を`learning_plans.plan_json`へ永続化する書き込み経路(Supabase update)も本計画では未実装。バックエンド側のプロンプト修正+フロントの書き込み処理を追加で設計・実装する必要がある
- Home画面の週次実績サマリーは`plannedMinutes`(週次目標)を`plan_week_logs`から取得していない(現状`null`固定で呼んでいる。`plan_week_logs`テーブルへの書き込みフロー自体が未設計)
- プッシュ通知・オフライン対応は`frontend_design.md`§13の通りスコープ外
- **修正済み(2026-08-16、実機/実ブラウザで発見)**: Expo Web版が起動直後に`ExpoSecureStore.default.getValueWithKeyAsync is not a function`でクラッシュし、ログイン画面より先に進めなかった(`expo-secure-store`はKeychain/Keystoreのラッパーでブラウザには実装がないため)。`src/lib/web-storage-adapter.ts`(`window.localStorage`ベース、`SupportedStorage`インターフェースを満たす)を新規作成し、`src/lib/supabase.ts`で`Platform.OS === 'web'`により`createSecureStoreAdapter`/`createWebStorageAdapter`を出し分けるよう修正。Web版でのメール+パスワードによる新規登録・ログインの動作確認が可能になった
- **保留(OAuthログイン、2026-08-16)**: Google Cloud Console + Supabase Provider設定を完了し実機(Expo Go/Androidエミュレータ)で検証したところ、Google認証自体・Supabaseのセッション発行までは成功する一方、アプリへの復帰(リダイレクト)だけが`localhost:3000`(Supabaseの既定Site URL)にフォールバックし失敗する。実機ログ(`REDIRECT_TO`、Supabaseから返る`authorize URL`)で確認した限り、`redirect_to`パラメータは`exp://192.168.1.10:8081/--/oauth-callback`という値でSupabase側の許可リスト(完全一致で登録済み)と1文字も違わず送信されているにもかかわらずマッチしない。一方、ポート番号を含まない単純な`ascendo://oauth-callback`は同じ許可リストで正しくマッチして成功した実績がある(ブラウザ直接テストで確認)。これは自前のコード/設定のバグではなく、**GoTrue(Supabase Auth)側が`exp://ホスト:ポート/...`形式のリダイレクトURLを正しく照合できていない**ことが濃厚。`sign-up.tsx`/`forgot-password.tsx`も同じ理由でメール確認・パスワードリセットのディープリンクがExpo Go上では機能しないため、同様に`Linking.createURL()`へ修正済み(それぞれ`exp://.../sign-up-confirm`、`exp://.../reset-password`を許可リストに追加すれば動作する)。**OAuthログインボタンはこの問題により`signup-or-login.tsx`で非表示中**(コード自体は`src/features/auth/oauth.ts`に残置)。次回再開時は Development Build(`npx expo run:android`)に切り替え、Expo Go固有の`exp://`スキームを経由せず実際の`ascendo://`スキームでOS登録して検証するのが確実な解決策。ユーザー判断により、当面はメール+パスワードでの登録・ログイン(Web版で新規登録→メール確認→同じ認証情報でAndroid版にログイン、という運用)を優先する方針とした
- **修正済み(2026-08-16、実機で発見)**: Android実機/エミュレータでExpo Go実行したところ、Task 17の`expo-av`が`Cannot find native module 'ExponentAV'`でクラッシュした。SDK 57のExpo Goから`expo-av`のネイティブモジュールが既に削除されていたことが原因(Web版の非推奨警告で予告されていた通り)。`expo-audio`の`useAudioPlayer`フックへ移行して解決(`app.config.ts`に`"plugins": ["expo-audio"]`を追加)。**教訓**: Web版のバンドル成功だけでは実機依存の問題(ネイティブモジュールの有無)は検出できない。実機/エミュレータでの確認は省略できない
- **修正済み(2026-08-16、実機で発見)**: `app/(auth)/_layout.tsx`(認証グループの入口ガード)がTask 6の`Files`一覧に含まれておらず、そもそも一度も作成されていなかった。この結果、アプリ起動時にルート("/")がTask 1の仮プレースホルダー(`app/index.tsx`、「Ascendo」とだけ表示)のまま止まり、`(auth)`/`(app)`どちらのフローにも入れなかった(実機でユーザーが発見)。`app/index.tsx`を`/(auth)/onboarding`へのリダイレクトに変更し、新規`app/(auth)/_layout.tsx`でログイン済みユーザーを`/(app)`へリダイレクトする対のガードを追加して解決。**教訓**: `frontend_design.md`§5のルート構成表に`(auth)/_layout.tsx`が明記されていたにもかかわらず、実装計画(Task 6)のFiles一覧作成時に転記漏れが起きていた。設計書と実装計画のタスク分割を突き合わせる工程が抜けていたことが根本原因
- **既知の未修正**: `hasSeenOnboarding`フラグ(Task 6)は`markOnboardingSeen`で書き込まれるが、`onboarding.tsx`は起動時にこのフラグを読んで自動スキップする処理を持たない。そのため現状は毎回onboarding画面が表示される(機能上のブロッカーではないが、設計意図とは異なる)
- **修正済み(2026-08-17、実機/実ブラウザで発見)**: Web版でメール確認リンクをタップした後、ブラウザが無限にナビゲーションを繰り返す不具合が2段階で見つかった。①`app/_layout.tsx`のディープリンク処理(`Linking`の`'url'`イベント)がWeb版では画面遷移のたびに再発火し、確認リンクの`#access_token=...`フラグメントがアドレスバーに残り続けるため同じリンクを何度も処理していた→`lastHandledUrl`による再入防止と、処理後に`history.replaceState`でフラグメントを除去して解決。②それでも実機では別のループが継続し、実機コンソールログ(`[app-layout] render`を一時的に仕込んで採取)で`hasActivePlan`が`false`⇄`null`を無限に往復していることが判明。原因は`(app)/_layout.tsx`のTask 6実装(`useState`で`hasActivePlan`をローカル管理)が`<Redirect href="/(app)/plan-creation">`によって`(app)`グループ自身のレイアウトを再マウントさせ、`useState`の初期値`null`に巻き戻ってはまた同じクエリ→同じリダイレクトを繰り返す、という自己再入だった。**対応**: `hasActivePlan`をローカルstateから`AuthContext`(アプリルートの`AuthProvider`、`(app)`グループ配下のナビゲーションでは再マウントされない)へ移設。`auth-reducer.ts`の`signed-in`状態に`hasActivePlan`フィールドと`ACTIVE_PLAN_RESOLVED`イベントを追加し、`guard-logic.ts`の`determineRedirect`は`AuthState`全体を受け取る形にシグネチャ変更。**教訓**: レイアウトコンポーネント(`_layout.tsx`)が「自分自身が属するグループ内のルートへ`<Redirect>`する」設計は再マウントを誘発しうるため、そのレイアウト固有のローカルstateにリダイレクト判断を依存させない(親のContext等、再マウントされない場所に状態を置く)。③しかし②の対応後も実機で`Uncaught Error: Maximum update depth exceeded`(`app/_layout.tsx`の`<Stack />`を指す)が発生。`hasActivePlan`が安定した値をContextから同期的に読めるようになった結果、以前は非同期クエリで自然に間引かれていたループが同期的な速度で回るようになり、Reactのネスト更新上限に達するようになっただけだった。**真因**: `(app)/_layout.tsx`は`plan-creation.tsx`自身も含めた`(app)`グループ全体をラップしているため、ユーザーが`plan-creation`画面に居る間も`hasActivePlan: false`である限り「`/plan-creation`へリダイレクトせよ」という判定を毎レンダー下し続け、**現在地への自己リダイレクト**を無限に繰り返していた。`determineRedirect`に`usePathname()`由来の現在パスを渡し、`currentPath === '/plan-creation'`のときはリダイレクトしないよう修正して解消。**教訓その2**: 「特定条件でルートAへ誘導する」ガードは、ルートA自身に対しても評価されるなら「今ルートAに居るか」を必ず考慮しないと、到達後も判定が真であり続ける限り自己ループする
