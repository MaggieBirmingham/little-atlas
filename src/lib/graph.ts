import type { MapEdge, MapNode, NodeKind } from './types'

/** Walks parent_id pointers up to the root. Throws nothing — just returns the chain. */
export function ancestorChain(nodes: MapNode[], nodeId: string | null): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const chain: string[] = []
  let cursor = nodeId
  const seen = new Set<string>()
  while (cursor) {
    if (seen.has(cursor)) break // already-corrupt data; stop rather than infinite loop
    seen.add(cursor)
    chain.push(cursor)
    cursor = byId.get(cursor)?.parent_id ?? null
  }
  return chain
}

/** Would re-parenting `nodeId` under `newParentId` create a cycle in the tree?
 * True if newParentId is nodeId itself, or a descendant of nodeId. */
export function wouldCreateCycle(nodes: MapNode[], nodeId: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  if (newParentId === nodeId) return true
  const chain = ancestorChain(nodes, newParentId)
  return chain.includes(nodeId)
}

/** Case/whitespace-insensitive duplicate check among siblings under the same parent.
 * Mirrors the DB unique constraint so the UI can give instant feedback. */
export function isDuplicateSibling(
  nodes: MapNode[],
  parentId: string | null,
  label: string,
  excludeId?: string
): boolean {
  const norm = label.trim().toLowerCase()
  return nodes.some(
    (n) => n.id !== excludeId && n.parent_id === parentId && n.label.trim().toLowerCase() === norm
  )
}

/** Cross-link edges are undirected in spirit: prevent self-links and duplicate
 * pairs regardless of direction (a->b counts as the same link as b->a). */
export function isDuplicateEdge(edges: MapEdge[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true
  return edges.some(
    (e) => (e.from_node === fromId && e.to_node === toId) || (e.from_node === toId && e.to_node === fromId)
  )
}

export interface LaidOutNode {
  node: MapNode
  x: number
  y: number
  depth: number
  angle: number
}

/** Deterministic radial ("branching web") layout: center node at the origin,
 * each depth gets its own ring radius, and each node's angular slice is a
 * stable, even subdivision of its parent's slice (sorted by created_at then
 * id, so the layout never jitters between renders/sessions).
 *
 * This intentionally avoids a physics/force-directed simulation: same data
 * in -> same pixel positions out, every time, which keeps the map calm and
 * predictable rather than jiggling — important for a "low-pressure" feel
 * and for phones where a jumpy layout is disorienting. */
export function computeRadialLayout(
  nodes: MapNode[],
  opts: { ringGap?: number; centerId?: string } = {}
): LaidOutNode[] {
  const ringGap = opts.ringGap ?? 130
  const byParent = new Map<string | null, MapNode[]>()
  for (const n of nodes) {
    const key = n.parent_id
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  }

  const center = nodes.find((n) => n.kind === 'center' && (!opts.centerId || n.id === opts.centerId))
  const result: LaidOutNode[] = []
  if (!center) return result
  result.push({ node: center, x: 0, y: 0, depth: 0, angle: 0 })

  function place(parentId: string, parentX: number, parentY: number, depth: number, startAngle: number, sweep: number) {
    const children = byParent.get(parentId) ?? []
    if (children.length === 0) return
    const slice = sweep / children.length
    children.forEach((child, i) => {
      const angle = startAngle + slice * (i + 0.5)
      const radius = ringGap
      const x = parentX + Math.cos(angle) * radius
      const y = parentY + Math.sin(angle) * radius
      result.push({ node: child, x, y, depth, angle })
      // Each child explores a slice proportional to its own share, capped so
      // deep branches don't overlap their neighbours on small screens.
      const childSweep = Math.min(slice, Math.PI * 1.6)
      place(child.id, x, y, depth + 1, angle - childSweep / 2, childSweep)
    })
  }

  place(center.id, 0, 0, 1, 0, Math.PI * 2)
  return result
}

/** Bounding box of a laid-out set, with padding — used to size the SVG viewBox. */
export function layoutBounds(laid: LaidOutNode[], padding = 90) {
  if (laid.length === 0) return { minX: -padding, minY: -padding, maxX: padding, maxY: padding }
  const xs = laid.map((l) => l.x)
  const ys = laid.map((l) => l.y)
  return {
    minX: Math.min(...xs) - padding,
    minY: Math.min(...ys) - padding,
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding
  }
}

/** The node itself plus everything beneath it. */
export function descendantIds(nodes: MapNode[], rootId: string): Set<string> {
  const byParent = new Map<string, MapNode[]>()
  for (const n of nodes) {
    if (!n.parent_id) continue
    if (!byParent.has(n.parent_id)) byParent.set(n.parent_id, [])
    byParent.get(n.parent_id)!.push(n)
  }
  const out = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of byParent.get(cur) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return out
}

/** Nodes reachable from `rootId` by parent links, parents always before
 * children. Orphans and anything not connected to the root are dropped. */
export function treeOrder(nodes: MapNode[], rootId: string): MapNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const root = byId.get(rootId)
  if (!root) return []
  const byParent = new Map<string, MapNode[]>()
  for (const n of nodes) {
    if (!n.parent_id || n.id === rootId) continue
    if (!byParent.has(n.parent_id)) byParent.set(n.parent_id, [])
    byParent.get(n.parent_id)!.push(n)
  }
  const out: MapNode[] = [root]
  const seen = new Set<string>([rootId])
  for (let i = 0; i < out.length; i++) {
    const kids = (byParent.get(out[i].id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    for (const k of kids) {
      if (seen.has(k.id)) continue
      seen.add(k.id)
      out.push(k)
    }
  }
  return out
}

/** Which kinds of node may sit directly under each kind. */
const ALLOWED_PARENT_KINDS: Record<NodeKind, NodeKind[]> = {
  center: [],
  category: ['center'],
  subcategory: ['category'],
  hobby: ['subcategory', 'category', 'center'],
  custom: ['subcategory', 'category', 'center']
}

export interface ParentOption {
  node: MapNode
  ok: boolean
  reason?: string
}

/** Every place `node` could be moved to (excluding where it already is), with
 * a plain-language reason when a move would be refused. Mirrors the DB rules. */
export function parentOptionsFor(nodes: MapNode[], node: MapNode): ParentOption[] {
  const allowed = ALLOWED_PARENT_KINDS[node.kind]
  const options: ParentOption[] = []
  for (const candidate of nodes) {
    if (candidate.id === node.parent_id || !allowed.includes(candidate.kind)) continue
    if (wouldCreateCycle(nodes, node.id, candidate.id)) {
      options.push({ node: candidate, ok: false, reason: 'it is inside this branch' })
    } else if (isDuplicateSibling(nodes, candidate.id, node.label, node.id)) {
      options.push({ node: candidate, ok: false, reason: `it already has “${node.label}”` })
    } else {
      options.push({ node: candidate, ok: true })
    }
  }
  return options.sort((a, b) => a.node.label.localeCompare(b.node.label))
}
