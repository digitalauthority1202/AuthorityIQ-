import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Server-side client for authenticated requests. Uses the user's JWT when available. */
export function createSupabaseServerClient(accessToken?: string): SupabaseClient {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createClient(url, key, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Server-only client for trusted background work. Never expose this client to the browser. */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
