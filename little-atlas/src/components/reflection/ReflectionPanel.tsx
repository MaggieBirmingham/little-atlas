import { useState } from 'react'
import type { CatalogItem, MapSnapshot, NodeStatus } from '../../lib/types'
import type { UseMapData } from '../../hooks/useMapData'

interface Props {
  snapshot: MapSnapshot
  catalog: CatalogItem[]
  mapData: UseMapData
}

export function ReflectionPanel({ snapshot, catalog, mapData }: Props) {
  const [generalReflection, setGeneralReflection] = useState('')

  const onMapIds = new Set(snapshot.nodes.map((n) => n.catalog_id).filter((x): x is string => Boolean(x)))
  const itemsWithState = (state: 'saved_for_later' | 'not_for_me') =>
    snapshot.suggestionStates
      .filter((s) => s.state === state)
      .map((s) => catalog.find((c) => c.id === s.catalog_id))
      .filter((c): c is CatalogItem => Boolean(c) && !onMapIds.has((c as CatalogItem).id))
  const savedForLater = itemsWithState('saved_for_later')
  const hidden = itemsWithState('not_for_me')

  const activeHobbies = snapshot.nodes.filter((n) => (n.kind === 'hobby' || n.kind === 'custom') && n.origin === 'personal')

  const sortedReflections = [...snapshot.reflections].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, width: '100%' }}>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>Come back and reflect</h2>
        <p style={{ color: 'var(--color-ink-soft)' }}>
          No streaks, no scores — just a place to notice how things are going and let your map evolve with you.
        </p>
        <label htmlFor="general-reflection" className="sr-only">
          General reflection
        </label>
        <textarea
          id="general-reflection"
          rows={3}
          placeholder="What's shifted since you last looked at your map?"
          value={generalReflection}
          onChange={(e) => setGeneralReflection(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          style={{ marginTop: 8 }}
          disabled={!generalReflection.trim()}
          onClick={async () => {
            const res = await mapData.addReflection(generalReflection, null)
            if (res.ok) setGeneralReflection('')
          }}
        >
          Save reflection
        </button>
      </section>

      {savedForLater.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem' }}>Saved for later ({savedForLater.length})</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {savedForLater.map((item) => (
              <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <strong style={{ flex: 1 }}>{item.label}</strong>
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 12px' }}
                  onClick={() => mapData.addCatalogItem(item)}
                >
                  Add to my map
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 12px' }}
                  onClick={() => mapData.setSuggestionState(item.id, null)}
                >
                  Remove from saved
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem' }}>Hidden as “not for me” ({hidden.length})</h2>
          <p style={{ color: 'var(--color-ink-soft)' }}>Changed your mind? Bring one back and it will show up in suggestions again.</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {hidden.map((item) => (
              <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span style={{ flex: 1 }}>{item.label}</span>
                <button className="btn btn-ghost" style={{ padding: '4px 12px' }} aria-label={`Bring back ${item.label}`} onClick={() => mapData.setSuggestionState(item.id, null)}>
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeHobbies.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem' }}>How things are going</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {activeHobbies.map((n) => (
              <li key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span style={{ flex: 1 }}>{n.label}</span>
                <select
                  aria-label={`Status for ${n.label}`}
                  value={n.status ?? ''}
                  onChange={(e) => mapData.updateNode(n.id, { status: (e.target.value || null) as NodeStatus })}
                  style={{ padding: 6, borderRadius: 8, border: '1px solid var(--color-border)' }}
                >
                  <option value="">No status</option>
                  <option value="curious">Just curious</option>
                  <option value="trying">Trying it out</option>
                  <option value="active">Doing it regularly</option>
                  <option value="paused">On pause</option>
                  <option value="not_for_me">Not for me (for now)</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>Past reflections</h2>
        {sortedReflections.length === 0 ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>Nothing yet — your reflections will appear here.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {sortedReflections.map((r) => {
              const node = r.node_id ? snapshot.nodes.find((n) => n.id === r.node_id) : undefined
              return (
                <li key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ margin: 0 }}>{r.text}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>
                    {new Date(r.created_at).toLocaleDateString()} {node ? `· about ${node.label}` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
