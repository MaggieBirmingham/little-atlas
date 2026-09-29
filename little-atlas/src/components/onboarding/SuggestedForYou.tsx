import type { Recommendation } from '../../lib/recommend'
import type { UseMapData } from '../../hooks/useMapData'

interface Props {
  recommendations: Recommendation[]
  mapData: UseMapData
  onDismiss: () => void
}

/** A dismissible strip of a few catalog matches from the brainstorm, each
 * with a plain-language reason and the same three low-pressure actions as
 * every other suggestion. Nothing here is auto-added. */
export function SuggestedForYou({ recommendations, mapData, onDismiss }: Props) {
  if (recommendations.length === 0) return null
  return (
    <div className="card" style={{ margin: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>A few things from your brainstorm</h2>
        <button className="btn btn-ghost" onClick={onDismiss} aria-label="Dismiss suggestions">
          ✕
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
        {recommendations.slice(0, 5).map((rec) => (
          <li key={rec.item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong>{rec.item.label}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{rec.reasons[0]}</div>
            </div>
            <button className="btn btn-primary" style={{ padding: '4px 12px' }} onClick={() => mapData.addCatalogItem(rec.item)}>
              Add
            </button>
            <button className="btn" style={{ padding: '4px 12px' }} onClick={() => mapData.setSuggestionState(rec.item.id, 'saved_for_later')}>
              Save for later
            </button>
            <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => mapData.setSuggestionState(rec.item.id, 'not_for_me')}>
              Not for me
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
