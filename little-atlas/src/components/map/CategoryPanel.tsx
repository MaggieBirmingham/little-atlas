import { useEffect, useState } from 'react'
import type { CatalogItem, MapNode, MapSnapshot } from '../../lib/types'
import type { UseMapData } from '../../hooks/useMapData'
import { CATEGORY_DESCRIPTIONS } from '../../lib/recommend'
import { labelToCategoryKey } from '../../lib/ghosts'
import type { CatalogCategory } from '../../lib/types'

interface Props {
  node: MapNode
  snapshot: MapSnapshot
  catalog: CatalogItem[]
  mapData: UseMapData
  onClose: () => void
  onOpenNode: (nodeId: string) => void
  onOpenCatalog: (catalogId: string) => void
}

/** Opened when a category (or subcategory) is clicked: what it is, what's
 * already on the map under it, suggested branches with one-click actions,
 * and a place to add your own. */
export function CategoryPanel({ node, snapshot, catalog, mapData, onClose, onOpenNode, onOpenCatalog }: Props) {
  const [nameDraft, setNameDraft] = useState(node.label)
  const [customDraft, setCustomDraft] = useState('')
  useEffect(() => setNameDraft(node.label), [node.id, node.label])

  const isCategory = node.kind === 'category'
  const parent = node.parent_id ? snapshot.nodes.find((n) => n.id === node.parent_id) : undefined
  const categoryKey = (isCategory ? labelToCategoryKey.get(node.label) : parent ? labelToCategoryKey.get(parent.label) : undefined) as CatalogCategory | undefined
  const onMapIds = new Set(snapshot.nodes.map((n) => n.catalog_id).filter((x): x is string => Boolean(x)))
  const stateOf = (id: string) => snapshot.suggestionStates.find((s) => s.catalog_id === id)?.state
  const children = snapshot.nodes.filter((n) => n.parent_id === node.id).sort((a, b) => a.label.localeCompare(b.label))

  const suggestions = categoryKey
    ? catalog.filter((c) => c.category === categoryKey && (isCategory || c.subcategory.toLowerCase() === node.label.toLowerCase()) && !onMapIds.has(c.id) && stateOf(c.id) !== 'not_for_me')
    : []
  const bySubcategory = new Map<string, CatalogItem[]>()
  for (const s of suggestions) {
    if (!bySubcategory.has(s.subcategory)) bySubcategory.set(s.subcategory, [])
    bySubcategory.get(s.subcategory)!.push(s)
  }
  const dismissedCount = categoryKey
    ? catalog.filter((c) => c.category === categoryKey && stateOf(c.id) === 'not_for_me' && !onMapIds.has(c.id)).length
    : 0

  async function addCustom(kind: 'custom' | 'subcategory') {
    const res = await mapData.addNode({ kind, label: customDraft, parentId: node.id })
    if (res.ok) setCustomDraft('')
  }

  return (
    <div className="side-panel-inner">
      <button className="btn btn-ghost" onClick={onClose} style={{ float: 'right' }}>
        Close ✕
      </button>
      <h2 style={{ fontSize: '1.3rem', clear: 'both' }}>{node.label}</h2>
      <p style={{ lineHeight: 1.5 }}>
        {categoryKey && isCategory
          ? CATEGORY_DESCRIPTIONS[categoryKey]
          : isCategory
            ? 'A category you made yourself. Add anything that belongs here.'
            : 'A group of related interests.'}
      </p>

      <section>
        <h3 style={{ fontSize: '1rem' }}>On your map here ({children.length})</h3>
        {children.length === 0 ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>Nothing yet. Browse the suggestions below, or add your own.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {children.map((c) => (
              <li key={c.id}>
                <button className="btn" style={{ padding: '4px 12px' }} onClick={() => onOpenNode(c.id)}>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: '1rem' }}>Suggested branches</h3>
        {!categoryKey ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>
            Suggestions come from the starter catalog, which only covers the built-in categories. This one is yours (or was renamed), so add your own below.
          </p>
        ) : suggestions.length === 0 ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>You&apos;ve seen everything the starter catalog has for this one.</p>
        ) : (
          [...bySubcategory.entries()].map(([sub, items]) => (
            <div key={sub} style={{ marginBottom: 10 }}>
              <h4 style={{ fontSize: '0.9rem', margin: '6px 0', color: 'var(--color-ink-soft)' }}>{sub}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((item) => (
                  <li key={item.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px dashed var(--color-border)' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, textAlign: 'left', minWidth: 140 }} onClick={() => onOpenCatalog(item.id)}>
                      {item.label}
                      {stateOf(item.id) === 'saved_for_later' && <span style={{ color: 'var(--color-ink-soft)' }}> · saved</span>}
                    </button>
                    <button className="btn btn-primary" style={{ padding: '4px 10px' }} aria-label={`Add ${item.label} to my map`} onClick={() => mapData.addCatalogItem(item)}>
                      Add
                    </button>
                    {stateOf(item.id) !== 'saved_for_later' && (
                      <button className="btn" style={{ padding: '4px 10px' }} aria-label={`Save ${item.label} for later`} onClick={() => mapData.setSuggestionState(item.id, 'saved_for_later')}>
                        Save
                      </button>
                    )}
                    <button className="btn btn-ghost" style={{ padding: '4px 10px' }} aria-label={`${item.label}: not for me`} onClick={() => mapData.setSuggestionState(item.id, 'not_for_me')}>
                      Not for me
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {dismissedCount > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{dismissedCount} hidden as “not for me”. You can bring them back from Reflect.</p>}
      </section>

      <section style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 12 }}>
        <h3 style={{ fontSize: '1rem' }}>Add your own</h3>
        <label htmlFor="category-custom-input" className="sr-only">
          Something of your own to add under {node.label}
        </label>
        <input id="category-custom-input" type="text" value={customDraft} placeholder="Anything you're curious about" onChange={(e) => setCustomDraft(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" disabled={!customDraft.trim()} onClick={() => addCustom('custom')}>
            Add as an interest
          </button>
          {isCategory && (
            <button className="btn" disabled={!customDraft.trim()} onClick={() => addCustom('subcategory')}>
              Add as a subcategory
            </button>
          )}
        </div>
      </section>

      <section style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 12, marginTop: 14 }}>
        <h3 style={{ fontSize: '1rem' }}>Rename or remove</h3>
        <label htmlFor="category-rename-input">Name</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input id="category-rename-input" type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <button className="btn" disabled={!nameDraft.trim() || nameDraft.trim() === node.label} onClick={() => mapData.updateNode(node.id, { label: nameDraft })}>
            Save
          </button>
        </div>
        {isCategory && categoryKey && <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>Heads up: a renamed category stops receiving catalog suggestions.</p>}
        <button
          className="btn btn-danger"
          style={{ marginTop: 10 }}
          onClick={async () => {
            const n = children.length
            const msg = n > 0 ? `Remove “${node.label}” and the ${n} thing${n === 1 ? '' : 's'} under it?` : `Remove “${node.label}”?`
            if (!window.confirm(msg)) return
            const res = await mapData.deleteNode(node.id)
            if (res.ok) onClose()
          }}
        >
          Remove from my map
        </button>
      </section>
    </div>
  )
}
