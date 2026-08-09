import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createUserClient(supabaseUrl: string, anonKey: string, accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey);
}
