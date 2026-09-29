import { useEffect, useRef, useState } from 'react'

interface Props {
  onAddEntry: (text: string) => Promise<{ ok: boolean }>
  entries: { id: string; text: string }[]
  onFinish: () => void
  onSkip: () => void
}

const TOTAL_SECONDS = 10 * 60

/** Inspired loosely by the idea of a short, open-ended interest brainstorm
 * (in the spirit of Joe Wehbe's writing on curiosity mapping) — but this is
 * an original implementation, with no copied text, imagery, or branding. */
export function BrainstormCapture({ onAddEntry, entries, onFinish, onSkip }: Props) {
  const [draft, setDraft] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS)
  const [running, setRunning] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!running || secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [running, secondsLeft])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  async function submit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    // Keep the text in the box unless it was really saved, so a failed save
    // never silently eats what the person just wrote.
    const res = await onAddEntry(trimmed)
    if (res.ok) setDraft('')
    inputRef.current?.focus()
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '24px auto', padding: 28 }}>
      <h1 style={{ fontSize: '1.6rem' }}>What are you curious about lately?</h1>
      <p style={{ color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
        No wrong answers, nothing to finish, nothing to optimize. Jot down anything that crosses your mind for
        the next ten minutes — half-formed ideas, old hobbies, things you saw someone else doing and wondered
        about. This is just for you to look back on in a minute.
      </p>

      <div
        aria-live="polite"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--color-bg-soft)',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          padding: '6px 14px',
          margin: '8px 0 18px',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <span aria-hidden="true">⏳</span>
        <span>
          {running ? 'Take your time — ' : 'Timer paused — '}
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} left, or keep going as long as you like
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 10px' }} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Resume'}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="brainstorm-input" className="sr-only">
          Something you're curious about
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="brainstorm-input"
            ref={inputRef}
            type="text"
            placeholder="e.g. always wondered about pottery…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Add
          </button>
        </div>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {entries.map((e) => (
          <li
            key={e.id}
            style={{
              background: 'var(--color-sun)',
              color: '#4a3a10',
              borderRadius: 999,
              padding: '6px 14px',
              fontWeight: 600
            }}
          >
            {e.text}
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onSkip}>
          Skip this — start with a blank map
        </button>
        <button className="btn btn-secondary" onClick={onFinish} disabled={entries.length === 0}>
          I'm done for now → see my map
        </button>
      </div>
    </div>
  )
}
