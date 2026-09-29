import type { ReactNode } from 'react'

interface BannerProps {
  kind: 'error' | 'info' | 'saving'
  children: ReactNode
  onDismiss?: () => void
}

export function Banner({ kind, children, onDismiss }: BannerProps) {
  return (
    <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
      {onDismiss && (
        <button className="btn btn-ghost" style={{ marginLeft: 10, padding: '2px 10px' }} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  )
}
