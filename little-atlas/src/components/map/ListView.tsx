import { useMemo } from 'react'
import type { CatalogItem, MapNode, MapSnapshot } from '../../lib/types'
import { buildGhostNodes, existingCatalogIdSet, notForMeSet, type GhostNode } from '../../lib/ghosts'

interface Props {
  snapshot: MapSnapshot
  catalog: CatalogItem[]
  expanded: Set<string>
  onToggle: (id: string) => void
  /** Open the side panel for a node (details for hobbies, category panel for containers). */
  onOpen: (nodeId: string, ghost?: GhostNode) => void
}

/**
 * A complete, independent way to browse and act on the whole map using only
 * standard keyboard- and screen-reader-friendly HTML: nested lists and real
 * buttons, no drag/zoom gestures. Expanding, opening details, adding, moving
 * and linking all work here too, through the same side panel.
 */
export function ListView({ snapshot, catalog, expanded, onToggle, onOpen }: Props) {
  const existingCatalogIds = useMemo(() => existingCatalogIdSet(snapshot), [snapshot])
  const notForMe = useMemo(() => notForMeSet(snapshot), [snapshot])
  const { fauxNodes, metaById } = useMemo(
    () => buildGhostNodes(snapshot.nodes, catalog, expanded, existingCatalogIds, notForMe),
    [snapshot.nodes, catalog, expanded, existingCatalogIds, notForMe]
  )
  const allNodes = useMemo(() => [...snapshot.nodes, ...fauxNodes], [snapshot.nodes, fauxNodes])
  const childrenByParent = useMemo(() => {
    const map = new Map<string, MapNode[]>()
    for (const n of allNodes) {
      if (!n.parent_id) continue
      if (!map.has(n.parent_id)) map.set(n.parent_id, [])
      map.get(n.parent_id)!.push(n)
    }
    for (const list of map.values()) list.sort((a, b) => a.label.localeCompare(b.label))
    return map
  }, [allNodes])

  const center = snapshot.nodes.find((n) => n.kind === 'center')
  if (!center) return <p style={{ padding: 20 }}>Your map is empty. Add your first curiosity to get started.</p>

  function renderChildren(parentId: string, depth: number) {
    const children = childrenByParent.get(parentId)
    if (!children || children.length === 0) return null
    return (
      <ul style={{ listStyle: 'none', margin: 0, paddingLeft: depth === 0 ? 0 : 22 }}>
        {children.map((child) => {
          const ghost = metaById.get(child.id)
          const suggested = child.origin === 'suggested'
          const container = child.kind === 'category' || child.kind === 'subcategory'
          const isOpen = expanded.has(child.id)
          return (
            <li key={child.id} style={{ margin: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {container ? (
                  <button className="btn btn-ghost" style={{ padding: '4px 10px' }} aria-expanded={isOpen} onClick={() => onToggle(child.id)}>
                    {isOpen ? '▾' : '▸'} {child.label}
                    {suggested && <span className="sr-only"> (suggested)</span>}
                  </button>
                ) : (
                  <button
                    className="btn"
                    style={{ padding: '4px 12px', background: suggested ? 'var(--color-bg-soft)' : 'var(--color-surface)', borderStyle: suggested ? 'dashed' : 'solid' }}
                    onClick={() => onOpen(child.id, ghost)}
                  >
                    {child.label}
                    {suggested ? ' · suggested' : child.status ? ` · ${child.status.replace('_', ' ')}` : ''}
                  </button>
                )}
                {container && !suggested && (
                  <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: '0.85rem' }} aria-label={`Details for ${child.label}`} onClick={() => onOpen(child.id)}>
                    Details
                  </button>
                )}
              </div>
              {renderChildren(child.id, depth + 1)}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="card" style={{ margin: 16 }}>
      <h2 style={{ fontSize: '1.1rem' }}>{center.label}</h2>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: -6 }}>
        Expand a category to see suggestions; open “Details” for a category, or a hobby for its details and first steps.
      </p>
      {renderChildren(center.id, 0)}
    </div>
  )
}
