import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CatalogItem, MapNode, MapSnapshot } from '../../lib/types'
import { computeRadialLayout, layoutBounds } from '../../lib/graph'
import { buildGhostNodes, existingCatalogIdSet, notForMeSet, type GhostNode } from '../../lib/ghosts'

interface Props {
  snapshot: MapSnapshot
  catalog: CatalogItem[]
  expanded: Set<string>
  selectedNodeId: string | null
  /** Called for every non-centre tap; the app decides what it means. */
  onActivate: (nodeId: string, ghost?: GhostNode) => void
}

export type { GhostNode }

function nodeColor(n: MapNode): { fill: string; stroke: string; dash?: string } {
  if (n.kind === 'center') return { fill: 'var(--color-coral)', stroke: 'var(--color-coral-dark)' }
  if (n.origin === 'suggested') return { fill: 'var(--color-suggested)', stroke: 'var(--color-suggested-border)', dash: '5 4' }
  if (n.status === 'not_for_me') return { fill: '#e7e0d8', stroke: '#c9bdae' }
  if (n.kind === 'category') return { fill: 'var(--color-sage)', stroke: 'var(--color-sage-dark)' }
  if (n.kind === 'subcategory') return { fill: 'var(--color-sky)', stroke: '#4c7d90' }
  return { fill: 'var(--color-sun)', stroke: '#a97e17' }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function MapView({ snapshot, catalog, expanded, selectedNodeId, onActivate }: Props) {
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const existingCatalogIds = useMemo(() => existingCatalogIdSet(snapshot), [snapshot])
  const notForMe = useMemo(() => notForMeSet(snapshot), [snapshot])

  const { laidOut, ghostsById, bounds } = useMemo(() => {
    const { fauxNodes, metaById } = buildGhostNodes(snapshot.nodes, catalog, expanded, existingCatalogIds, notForMe)
    const laid = computeRadialLayout([...snapshot.nodes, ...fauxNodes])
    return { laidOut: laid, ghostsById: metaById, bounds: layoutBounds(laid) }
  }, [snapshot.nodes, catalog, expanded, existingCatalogIds, notForMe])

  const posById = useMemo(() => new Map(laidOut.map((l) => [l.node.id, l])), [laidOut])

  // Dragging pans the map, but only when the press starts on empty background:
  // capturing the pointer on the whole SVG would redirect the click away from
  // the node that was pressed.
  function handlePointerDown(e: ReactPointerEvent) {
    if ((e.target as Element).closest('[role="button"]')) return
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: ReactPointerEvent) {
    const start = dragRef.current
    if (!start) return
    setView((v) => ({ ...v, tx: start.tx + e.clientX - start.x, ty: start.ty + e.clientY - start.y }))
  }
  function handlePointerUp() {
    dragRef.current = null
  }

  function activate(node: MapNode) {
    if (node.kind === 'center') return
    onActivate(node.id, ghostsById.get(node.id))
  }

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY

  return (
    <div className="map-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', justifyContent: 'flex-end' }}>
        <button className="btn" style={{ padding: '4px 14px' }} aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, scale: Math.min(2.2, v.scale + 0.2) }))}>+</button>
        <button className="btn" style={{ padding: '4px 14px' }} aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.4, v.scale - 0.2) }))}>−</button>
        <button className="btn" style={{ padding: '4px 14px' }} aria-label="Reset view" onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>Reset</button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 280, overflow: 'hidden', touchAction: 'none' }}>
        <svg
          ref={svgRef}
          role="group"
          aria-label="Your interest map. The List view offers the same things without the picture."
          viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'var(--color-bg)' }}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {laidOut.map(({ node, x, y }) => {
              if (!node.parent_id) return null
              const parent = posById.get(node.parent_id)
              if (!parent) return null
              const dashed = node.origin === 'suggested'
              return (
                <path
                  key={`branch-${node.id}`}
                  d={`M ${parent.x} ${parent.y} Q ${(parent.x + x) / 2} ${(parent.y + y) / 2 - 14} ${x} ${y}`}
                  fill="none"
                  stroke={dashed ? 'var(--color-suggested-border)' : 'var(--color-border)'}
                  strokeWidth={dashed ? 1.5 : 2.5}
                  strokeDasharray={dashed ? '5 4' : undefined}
                />
              )
            })}

            {snapshot.edges.map((e) => {
              const a = posById.get(e.from_node)
              const b = posById.get(e.to_node)
              if (!a || !b) return null
              return (
                <path
                  key={`link-${e.id}`}
                  data-testid="cross-link"
                  d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + 28} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="var(--color-lilac)"
                  strokeWidth={2}
                  strokeDasharray="2 5"
                />
              )
            })}

            {laidOut.map(({ node, x, y, depth }) => {
              const colors = nodeColor(node)
              const radius = node.kind === 'center' ? 46 : node.kind === 'category' ? 34 : node.kind === 'subcategory' ? 26 : 22
              const selected = node.id === selectedNodeId
              const isCenter = node.kind === 'center'
              const expandable = node.kind === 'category' || node.kind === 'subcategory'
              return (
                <g
                  key={node.id}
                  transform={`translate(${x} ${y})`}
                  role={isCenter ? undefined : 'button'}
                  tabIndex={isCenter ? undefined : 0}
                  aria-label={isCenter ? undefined : `${node.label}${node.origin === 'suggested' ? ' (suggested)' : ''}`}
                  aria-expanded={expandable ? expanded.has(node.id) : undefined}
                  onClick={() => activate(node)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      activate(node)
                    }
                  }}
                  style={{ cursor: isCenter ? 'default' : 'pointer' }}
                >
                  <circle r={radius} fill={colors.fill} stroke={selected ? 'var(--color-coral-dark)' : colors.stroke} strokeWidth={selected ? 4 : 2} strokeDasharray={colors.dash} />
                  <text textAnchor="middle" dy={radius + 16} fontSize={depth === 0 ? 15 : 12.5} fontWeight={isCenter ? 700 : 600} fill="var(--color-ink)" style={{ pointerEvents: 'none', fontFamily: 'var(--font-body)' }}>
                    {truncate(node.label, 20)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <p className="card" style={{ margin: '8px 12px', fontSize: '0.85rem', padding: '8px 14px' }}>
        <strong>Key:</strong> <span style={{ color: 'var(--color-sage-dark)' }}>● category</span> · <span style={{ color: '#4c7d90' }}>● subcategory</span> ·{' '}
        <span style={{ color: '#a97e17' }}>● your interest</span> · <span style={{ color: 'var(--color-suggested-border)' }}>◌ suggested (dashed)</span> ·{' '}
        <span style={{ color: 'var(--color-lilac)' }}>· · · link</span>. Tap a category to see details and suggestions. Prefer text? Use the List tab.
      </p>
    </div>
  )
}
