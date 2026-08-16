import type { SupportedStorage } from './secure-store-adapter';

/** The subset of the browser's window.localStorage API this adapter needs. */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** supabase-js's SupportedStorage interface, satisfied via window.localStorage.
 * expo-secure-store has no web implementation (Keychain/Keystore don't exist in a browser),
 * so the web bundle must use a different storage backend — see src/lib/supabase.ts, which
 * picks this adapter over createSecureStoreAdapter based on Platform.OS === 'web'. */
export function createWebStorageAdapter(store: WebStorageLike): SupportedStorage {
  return {
    getItem: async (key) => store.getItem(key),
    setItem: async (key, value) => {
      store.setItem(key, value);
    },
    removeItem: async (key) => {
      store.removeItem(key);
    },
  };
}
