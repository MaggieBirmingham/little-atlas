import { useEffect, useMemo, useState } from 'react'
import type { CatalogItem, MapSnapshot, NodeStatus } from '../../lib/types'
import { descendantIds, isDuplicateSibling, parentOptionsFor, wouldCreateCycle } from '../../lib/graph'
import { relatedCatalogItems } from '../../lib/recommend'
import type { Selection } from '../../lib/selection'
import type { UseMapData } from '../../hooks/useMapData'

interface Props {
  selection: Selection
  snapshot: MapSnapshot
  catalog: CatalogItem[]
  mapData: UseMapData
  onClose: () => void
  onBack?: () => void
  onOpenCatalog: (catalogId: string) => void
}

const STATUS_OPTIONS: { value: NodeStatus; label: string }[] = [
  { value: null, label: 'No status' },
  { value: 'curious', label: 'Just curious' },
  { value: 'trying', label: 'Trying it out' },
  { value: 'active', label: 'Doing it regularly' },
  { value: 'paused', label: 'On pause' },
  { value: 'not_for_me', label: 'Not for me (for now)' }
]

export function DetailDrawer({ selection, snapshot, catalog, mapData, onClose, onBack, onOpenCatalog }: Props) {
  // A suggestion whose catalog entry has since been added to the map (from here,
  // from the category panel, or anywhere) resolves to that map node, so the
  // panel never shows "not on your map yet" for something that is.
  const suggestedCatalogId = selection.ghost?.catalogItem?.id ?? selection.catalogId
  const realNode =
    (selection.nodeId ? snapshot.nodes.find((n) => n.id === selection.nodeId) : undefined) ??
    (suggestedCatalogId ? snapshot.nodes.find((n) => n.catalog_id === suggestedCatalogId) : undefined)
  const catalogItem =
    selection.ghost?.catalogItem ??
    (selection.catalogId ? catalog.find((c) => c.id === selection.catalogId) : undefined) ??
    (realNode?.catalog_id ? catalog.find((c) => c.id === realNode.catalog_id) : undefined)
  const isSuggested = !realNode && Boolean(catalogItem)
  const label = realNode?.label ?? catalogItem?.label ?? selection.ghost?.label ?? ''
  const decision = catalogItem ? snapshot.suggestionStates.find((s) => s.catalog_id === catalogItem.id)?.state : undefined

  const [labelDraft, setLabelDraft] = useState(realNode?.label ?? '')
  const [notesDraft, setNotesDraft] = useState(realNode?.notes ?? '')
  const [reflectionDraft, setReflectionDraft] = useState('')
  const [labelError, setLabelError] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [linkTarget, setLinkTarget] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLabelDraft(realNode?.label ?? '')
    setNotesDraft(realNode?.notes ?? '')
    setLabelError(null)
    setMoveTarget('')
    setLinkTarget('')
    setNotice(null)
  }, [realNode?.id, realNode?.label, realNode?.notes])

  const stale = !realNode && !catalogItem
  useEffect(() => {
    if (stale) onClose()
  }, [stale, onClose])

  const related = catalogItem ? relatedCatalogItems(catalogItem, catalog) : []

  const parentOptions = useMemo(() => (realNode ? parentOptionsFor(snapshot.nodes, realNode) : []), [snapshot.nodes, realNode])
  const currentParent = realNode?.parent_id ? snapshot.nodes.find((n) => n.id === realNode.parent_id) : undefined

  const links = realNode
    ? snapshot.edges
        .filter((e) => e.from_node === realNode.id || e.to_node === realNode.id)
        .map((e) => ({ edge: e, other: snapshot.nodes.find((n) => n.id === (e.from_node === realNode.id ? e.to_node : e.from_node)) }))
    : []
  const linkCandidates = realNode
    ? snapshot.nodes
        .filter((n) => n.kind !== 'center' && n.id !== realNode.id)
        .filter((n) => !links.some((l) => l.other?.id === n.id))
        .filter((n) => !wouldCreateCycle(snapshot.nodes, realNode.id, n.id) && !wouldCreateCycle(snapshot.nodes, n.id, realNode.id))
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  if (stale) return null

  async function handleAdd() {
    if (!catalogItem) return
    setBusy(true)
    await mapData.addCatalogItem(catalogItem) // the panel then resolves to the new node by itself
    setBusy(false)
  }

  async function handleDecision(state: 'saved_for_later' | 'not_for_me' | null) {
    if (!catalogItem) return
    const res = await mapData.setSuggestionState(catalogItem.id, state)
    if (res.ok && state === 'not_for_me') onClose()
  }

  async function handleRename() {
    if (!realNode) return
    const trimmed = labelDraft.trim()
    if (!trimmed) return setLabelError('Give it a name.')
    if (trimmed !== realNode.label && isDuplicateSibling(snapshot.nodes, realNode.parent_id, trimmed, realNode.id)) {
      return setLabelError('You already have something with that name here.')
    }
    setLabelError(null)
    await mapData.updateNode(realNode.id, { label: trimmed })
  }

  async function handleDelete() {
    if (!realNode) return
    const below = descendantIds(snapshot.nodes, realNode.id).size - 1
    const msg = below > 0 ? `Remove “${realNode.label}” and the ${below} thing${below === 1 ? '' : 's'} under it? This can't be undone.` : `Remove “${realNode.label}” from your map?`
    if (!window.confirm(msg)) return
    const res = await mapData.deleteNode(realNode.id)
    if (res.ok) onClose()
  }

  async function handleMove() {
    if (!realNode || !moveTarget) return
    const target = snapshot.nodes.find((n) => n.id === moveTarget)
    const res = await mapData.moveNode(realNode.id, moveTarget)
    if (res.ok) {
      setMoveTarget('')
      setNotice(`Moved under “${target?.label ?? 'new place'}”.`)
    }
  }

  async function handleLink() {
    if (!realNode || !linkTarget) return
    const other = snapshot.nodes.find((n) => n.id === linkTarget)
    const res = await mapData.addEdge(realNode.id, linkTarget)
    if (res.ok) {
      setLinkTarget('')
      setNotice(`Linked to “${other?.label ?? 'item'}”.`)
    }
  }

  return (
    <div className="side-panel-inner">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {onBack ? (
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-ghost" onClick={onClose}>
          Close ✕
        </button>
      </div>
      <h2 style={{ fontSize: '1.3rem' }}>{label}</h2>

      {isSuggested && (
        <p style={{ display: 'inline-block', background: 'var(--color-suggested)', color: '#233', padding: '3px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
          Suggested — not on your map yet
          {decision === 'saved_for_later' ? ' · saved for later' : ''}
        </p>
      )}

      {catalogItem && (
        <>
          <p style={{ lineHeight: 1.5 }}>{catalogItem.description}</p>

          {catalogItem.possible_benefits.length > 0 && (
            <section>
              <h3 style={{ fontSize: '1rem' }}>Possible benefits</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)', marginTop: -6 }}>General observations, not medical advice or a guarantee.</p>
              <ul>{catalogItem.possible_benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </section>
          )}

          {catalogItem.beginner_steps.length > 0 && (
            <section>
              <h3 style={{ fontSize: '1rem' }}>Beginner steps</h3>
              <ol>{catalogItem.beginner_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          )}

          <section>
            <h3 style={{ fontSize: '1rem' }}>Time, cost & access</h3>
            <p>{catalogItem.time_cost_access}</p>
          </section>

          {catalogItem.links.length > 0 && (
            <section>
              <h3 style={{ fontSize: '1rem' }}>Helpful links</h3>
              <ul>
                {catalogItem.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <h3 style={{ fontSize: '1rem' }}>Related interests</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {related.map((r) => {
                  const onMap = snapshot.nodes.some((n) => n.catalog_id === r.id)
                  return (
                    <li key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0' }}>
                      <button className="btn btn-ghost" style={{ border: '1px solid var(--color-border)', padding: '4px 10px' }} onClick={() => onOpenCatalog(r.id)}>
                        {r.label}
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{onMap ? 'on your map' : 'not on your map yet'}</span>
                      {!onMap && (
                        <button className="btn btn-primary" style={{ padding: '2px 10px' }} aria-label={`Add ${r.label} to my map`} onClick={() => mapData.addCatalogItem(r)}>
                          Add
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>
            Source: {catalogItem.source_label} · reviewed {catalogItem.reviewed_on}
          </p>
        </>
      )}

      {isSuggested && catalogItem && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={busy}>
            + Add to my map
          </button>
          {decision === 'saved_for_later' ? (
            <button className="btn" onClick={() => handleDecision(null)}>Remove from saved</button>
          ) : (
            <button className="btn" onClick={() => handleDecision('saved_for_later')}>Save for later</button>
          )}
          <button className="btn btn-ghost" onClick={() => handleDecision('not_for_me')}>Not for me</button>
        </div>
      )}

      {realNode && realNode.kind !== 'center' && (
        <div style={{ marginTop: 18, borderTop: '1px dashed var(--color-border)', paddingTop: 14 }}>
          <h3 style={{ fontSize: '1rem' }}>Your notes</h3>
          {notice && <p role="status" style={{ color: 'var(--color-sage-dark)', fontWeight: 600 }}>{notice}</p>}

          <label htmlFor="rename-input">Name</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input id="rename-input" type="text" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} />
            <button className="btn" onClick={handleRename}>Save</button>
          </div>
          {labelError && <p role="alert" style={{ color: '#b3413a', fontSize: '0.85rem' }}>{labelError}</p>}

          {(realNode.kind === 'hobby' || realNode.kind === 'custom') && (
            <>
              <label htmlFor="status-select">How&apos;s it going?</label>
              <select
                id="status-select"
                value={realNode.status ?? ''}
                onChange={(e) => mapData.updateNode(realNode.id, { status: (e.target.value || null) as NodeStatus })}
                style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
            </>
          )}

          <label htmlFor="notes-textarea">Private notes</label>
          <textarea
            id="notes-textarea"
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => notesDraft !== (realNode.notes ?? '') && mapData.updateNode(realNode.id, { notes: notesDraft })}
          />

          <h3 style={{ fontSize: '1rem', marginTop: 16 }}>Where it lives</h3>
          <p style={{ margin: '0 0 6px' }}>
            Currently under <strong>{currentParent?.label ?? 'nothing'}</strong>.
          </p>
          {parentOptions.length === 0 ? (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem' }}>There is nowhere else this kind of item can go.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <label htmlFor="move-select" className="sr-only">Move to</label>
              <select id="move-select" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <option value="">Move to…</option>
                {parentOptions.map((o) => (
                  <option key={o.node.id} value={o.node.id} disabled={!o.ok}>
                    {o.node.label}{o.ok ? '' : ` (unavailable: ${o.reason})`}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={handleMove} disabled={!moveTarget}>Move</button>
            </div>
          )}

          <h3 style={{ fontSize: '1rem', marginTop: 16 }}>Connections</h3>
          {links.length === 0 ? (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem' }}>Not linked to anything yet. Links show as dotted lines on the map.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {links.map(({ edge, other }) => (
                <li key={edge.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                  <span style={{ flex: 1 }}>{other?.label ?? 'Unknown item'}</span>
                  <button className="btn btn-ghost" style={{ padding: '2px 10px' }} aria-label={`Remove link to ${other?.label ?? 'item'}`} onClick={() => mapData.removeEdge(edge.id)}>
                    Remove link
                  </button>
                </li>
              ))}
            </ul>
          )}
          {linkCandidates.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <label htmlFor="link-select" className="sr-only">Link to</label>
              <select id="link-select" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <option value="">Link to…</option>
                {linkCandidates.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
              <button className="btn" onClick={handleLink} disabled={!linkTarget}>Link</button>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label htmlFor="reflection-textarea">Add a reflection about this</label>
            <textarea id="reflection-textarea" rows={2} value={reflectionDraft} onChange={(e) => setReflectionDraft(e.target.value)} placeholder="How did it go? What did you notice?" />
            <button
              className="btn btn-secondary"
              style={{ marginTop: 6 }}
              onClick={async () => {
                const res = await mapData.addReflection(reflectionDraft, realNode.id)
                if (res.ok) setReflectionDraft('')
              }}
              disabled={!reflectionDraft.trim()}
            >
              Save reflection
            </button>
          </div>

          <button className="btn btn-danger" style={{ marginTop: 18 }} onClick={handleDelete}>
            Remove from my map
          </button>
        </div>
      )}
    </div>
  )
}
