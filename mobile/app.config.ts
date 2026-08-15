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
