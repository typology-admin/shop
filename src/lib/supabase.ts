import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from './env.ts';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    client = createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
