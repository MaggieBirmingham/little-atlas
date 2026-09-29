import { createClient } from '@supabase/supabase-js'

// IMPORTANT: only PUBLIC Supabase configuration may live in frontend assets.
// The anon key is meant to be exposed to browsers; every table it can touch
// is protected by Row Level Security policies (see supabase/migrations).
// Never put the service_role key here or in any VITE_* variable.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[little-atlas] Supabase env vars are missing. Running in guest-only mode. ' +
      'Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable accounts.'
  )
}

// A harmless placeholder URL lets the client construct without throwing when
// unconfigured (e.g. local dev before .env is set up, or CI unit tests).
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'https://placeholder.supabase.co',
isSupabaseConfigured ? anonKey! : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)
