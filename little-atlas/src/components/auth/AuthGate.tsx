import { useState } from 'react'
import type { FormEvent } from 'react'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

interface Props {
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  onContinueAsGuest: () => void
}

export function AuthGate({ sendMagicLink, onContinueAsGuest }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await sendMagicLink(email.trim())
    if (error) {
      setError(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 440, margin: '48px auto', padding: 28 }}>
      <h1 style={{ fontSize: '1.5rem' }}>🗺️ Little Atlas</h1>
      <p style={{ color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
        A gentle place to map what you're curious about, at your own pace.
      </p>

      {status === 'sent' ? (
        <div className="banner banner-info" role="status">
          Check <strong>{email}</strong> for a sign-in link. You can close this tab.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email-input">Email</label>
          <input
            id="email-input"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} disabled={status === 'sending' || !isSupabaseConfigured}>
            {status === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
          {!isSupabaseConfigured && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>
              Accounts aren't configured in this deployment yet — you can still explore as a guest below.
            </p>
          )}
          {error && (
            <p role="alert" style={{ color: '#b3413a' }}>
              {error}
            </p>
          )}
        </form>
      )}

      <div style={{ textAlign: 'center', margin: '18px 0', color: 'var(--color-ink-soft)' }}>or</div>

      <button className="btn" style={{ width: '100%' }} onClick={onContinueAsGuest}>
        Continue as a guest for now
      </button>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
        Guest drafts are saved on this device and can be added to your account any time you sign in.
      </p>
    </div>
  )
}
