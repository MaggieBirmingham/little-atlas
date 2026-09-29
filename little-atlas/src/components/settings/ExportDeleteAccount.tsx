import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import { guestStorage } from '../../lib/guestStore'

interface Props {
  session: Session | null
  displayName: string
  exportJson: () => string
  onSignOut: () => Promise<{ error: string | null }>
}

export function ExportDeleteAccount({ session, displayName, exportJson, onSignOut }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null)

  function handleExport() {
    const json = exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `little-atlas-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAccount() {
    if (!session) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // Account deletion is privileged (it removes the auth.users row itself,
      // which requires the service_role key). That key must never reach the
      // browser, so this calls a server-side Supabase Edge Function instead —
      // see supabase/functions/delete-account and the README for setup.
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      // From here on the account and all its server-side data are gone.
      const notes: string[] = ['Your account and its data were deleted.']
      const cleared = guestStorage.clear()
      if (!cleared.ok) notes.push(`A local guest draft in this browser could not be removed (${cleared.error}).`)
      const signedOut = await onSignOut()
      if (signedOut.error) notes.push(`Signing out on this device failed (${signedOut.error}); closing this tab will end the session.`)
      setDeletedNotice(notes.join(' '))
      setShowConfirm(false)
    } catch (e) {
      setDeleteError(
        e instanceof Error
          ? `Could not delete your account: ${e.message}. If this keeps happening, the delete-account Edge Function may not be deployed yet — see the README.`
          : 'Could not delete your account.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>Export your data</h2>
        <p style={{ color: 'var(--color-ink-soft)' }}>
          Download everything on your map — nodes, notes, reflections, and brainstorm entries — as a plain JSON
          file you can keep or move elsewhere.
        </p>
        <button className="btn btn-primary" onClick={handleExport}>
          Download my data (.json)
        </button>
      </section>

      {session && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem' }}>Account</h2>
          <p>
            Signed in as <strong>{session.user.email}</strong> · map name "{displayName}"
          </p>
          <button className="btn" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>Delete account</h2>
        {deletedNotice && <p role="status" style={{ fontWeight: 600 }}>{deletedNotice}</p>}
        <p style={{ color: 'var(--color-ink-soft)' }}>
          Permanently deletes your account and every row of your data (map, notes, reflections, brainstorm
          entries). This cannot be undone.
        </p>
        {!isSupabaseConfigured || !session ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>
            You're using Little Atlas as a guest, so there's no account to delete — clearing your browser data
            removes your local draft.
          </p>
        ) : !showConfirm ? (
          <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
            Delete my account
          </button>
        ) : (
          <div>
            <label htmlFor="confirm-delete">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input id="confirm-delete" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-danger"
                disabled={confirmText !== 'DELETE' || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'Deleting…' : 'Permanently delete my account'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
            </div>
            {deleteError && (
              <p role="alert" style={{ color: '#b3413a' }}>
                {deleteError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
