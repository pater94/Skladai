import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseAuthStorage } from './native-storage';

// Singleton browser client — ensures OAuth session is shared across all callers
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Custom storage: uses Capacitor Preferences (UserDefaults) on iOS native,
      // localStorage on web. UserDefaults survives app close/reopen on iOS,
      // unlike WKWebView localStorage which gets wiped aggressively.
      // NOTE: do NOT override storageKey — Supabase derives it from the project URL
      // and the OAuth callback hash references that default key.
      storage: supabaseAuthStorage,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return browserClient;
}

// Server-side admin client (bypasses RLS, uses service role key)
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
