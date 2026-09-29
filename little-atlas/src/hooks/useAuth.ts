import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

export interface AuthState {
  session: Session | null
  loading: boolean
  authError: string | null
  clearAuthError: () => void
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
}

// The redirect target for magic links. Under GitHub Pages a project site
// lives at https://<user>.github.io/little-atlas/, so we must send Supabase
// back to that *exact* sub-path; the origin root would 404.
//
// Design decision: Little Atlas has NO client-side router and no route-based
// URL hash of its own. Supabase's magic-link flow returns the session as a URL
// fragment (#access_token=...), and GitHub Pages project sites can't serve
// arbitrary deep links. A hash router would collide with Supabase over the
// same fragment, so the app is one page with in-memory view state (App.tsx)
// and the hash is left entirely to the Supabase client.
export function getRedirectTo(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${window.location.origin}${base}`
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setAuthError(`Couldn't check whether you're signed in: ${error.message}`)
        setSession(data.session)
      })
      .catch((e: unknown) => {
        if (!cancelled) setAuthError(`Couldn't check whether you're signed in: ${e instanceof Error ? e.message : String(e)}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function sendMagicLink(email: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: 'Accounts are not configured yet. You can still use Little Atlas as a guest.' }
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: getRedirectTo() } })
    return { error: error?.message ?? null }
  }

  async function signOut(): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: null }
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(`Couldn't sign you out: ${error.message}`)
    return { error: error?.message ?? null }
  }

  return { session, loading, authError, clearAuthError: () => setAuthError(null), sendMagicLink, signOut }
}
