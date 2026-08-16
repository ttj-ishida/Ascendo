import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { createSecureStoreAdapter } from './secure-store-adapter';
import { platformStore } from './platform-secure-store';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing from app.config.ts extra');
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    storage: createSecureStoreAdapter(platformStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
