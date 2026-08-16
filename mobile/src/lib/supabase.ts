import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { createSecureStoreAdapter } from './secure-store-adapter';
import { createWebStorageAdapter } from './web-storage-adapter';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing from app.config.ts extra');
}

// expo-secure-store has no web implementation (there's no Keychain/Keystore in a browser) and
// throws at runtime there — found via real Expo Web testing. window.localStorage stands in on
// web; native platforms keep using the Keychain/Keystore-backed adapter.
const storage =
  Platform.OS === 'web' ? createWebStorageAdapter(window.localStorage) : createSecureStoreAdapter(SecureStore);

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
