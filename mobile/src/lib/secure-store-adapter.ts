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
