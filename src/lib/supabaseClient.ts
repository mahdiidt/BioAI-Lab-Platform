import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read at build time by Vite. Must be set in a local .env file (see .env.example)
// and — for the GitHub Pages deploy — as repository/Actions variables so the
// GitHub Actions workflow can inject them into the production build.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True only when both env vars are present. The rest of the app checks this
 * flag instead of assuming Supabase is always configured, so the site keeps
 * working (tools, favorites, etc.) even before auth is wired up in production.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[BioAI Lab] Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing). ' +
      'Sign in / Sign up will show a friendly notice instead of a hard error.'
  );
}
