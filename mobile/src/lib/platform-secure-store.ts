import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SecureStoreLike } from './secure-store-adapter';

/** The subset of the browser's window.localStorage API this shim needs. */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Wraps window.localStorage to satisfy the same SecureStoreLike shape expo-secure-store
 * exposes on native, so every call site (supabase.ts's session storage, onboarding-flag.ts)
 * can depend on one interface regardless of platform. */
export function createWebSecureStore(store: WebStorageLike): SecureStoreLike {
  return {
    getItemAsync: async (key) => store.getItem(key),
    setItemAsync: async (key, value) => {
      store.setItem(key, value);
    },
    deleteItemAsync: async (key) => {
      store.removeItem(key);
    },
  };
}

// expo-secure-store wraps the Keychain (iOS) / Keystore (Android), neither of which exists in a
// browser — calling it there throws (e.g. "ExpoSecureStore.default.setValueWithKeyAsync is not
// a function"), found via real Expo Web testing on two separate call sites (supabase.ts and
// onboarding.tsx). Every SecureStore-shaped storage in the app should go through this single
// platform-picked instance instead of importing expo-secure-store directly.
export const platformStore: SecureStoreLike =
  Platform.OS === 'web' ? createWebSecureStore(window.localStorage) : SecureStore;
