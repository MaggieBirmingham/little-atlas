import type { CatalogItem, MapNode, MapSnapshot } from './types'
import { CATEGORY_LABELS } from './recommend'

export interface GhostNode {
  id: string
  parentRealOrGhostId: string
  label: string
  level: 'subcategory' | 'hobby'
  categoryKey: string
  subcategory: string
  catalogItem?: CatalogItem
}

export const labelToCategoryKey = new Map(Object.entries(CATEGORY_LABELS).map(([k, v]) => [v, k]))

/**
 * Pure function: given the user's real nodes, the catalog, and which node
 * ids are currently "expanded", returns synthetic "ghost" nodes representing
 * not-yet-added suggestions. Ghosts are never persisted — they exist only
 * for this render, in both MapView and ListView, so the two always agree.
 *
 * Two expansion concerns are deliberately decoupled:
 *  - Expanding a CATEGORY reveals suggested SUBCATEGORY branches the person
 *    hasn't added yet (subcategories they already added are always visible
 *    as normal nodes regardless of category expansion).
 *  - Expanding a SUBCATEGORY (real or suggested) reveals suggested HOBBY
 *    leaves under it — independent of whether the parent category is
 *    currently expanded, so revisiting an already-added subcategory for
 *    more ideas doesn't require re-expanding its parent first.
 */
export function buildGhostNodes(
  realNodes: MapNode[],
  catalog: CatalogItem[],
  expanded: Set<string>,
  existingCatalogIds: Set<string>,
  notForMe: Set<string>
): { fauxNodes: MapNode[]; metaById: Map<string, GhostNode> } {
  const ghosts: GhostNode[] = []
  const fauxNodes: MapNode[] = []
  let order = 0

  const byId = new Map(realNodes.map((n) => [n.id, n]))
  const realChildrenByParent = new Map<string, MapNode[]>()
  for (const n of realNodes) {
    if (!n.parent_id) continue
    if (!realChildrenByParent.has(n.parent_id)) realChildrenByParent.set(n.parent_id, [])
    realChildrenByParent.get(n.parent_id)!.push(n)
  }

  function pushHobbyGhosts(parentId: string, categoryKey: string, subcategory: string) {
    const items = catalog
      .filter((c) => c.category === categoryKey && c.subcategory === subcategory && !existingCatalogIds.has(c.id) && !notForMe.has(c.id))
      .sort((a, b) => a.label.localeCompare(b.label))
    for (const item of items) {
      const hid = `ghosthobby:${parentId}:${item.id}`
      ghosts.push({ id: hid, parentRealOrGhostId: parentId, label: item.label, level: 'hobby', categoryKey, subcategory, catalogItem: item })
      fauxNodes.push(makeFaux(hid, 'hobby', item.label, parentId, item.id, order++))
    }
  }

  // Step 1 + 3: category expansion reveals ghost subcategories (skipping
  // ones the user already added for real), and those ghost subcategories,
  // if themselves expanded, reveal their hobby ghosts.
  for (const node of realNodes) {
    if (node.kind !== 'category' || !expanded.has(node.id)) continue
    const categoryKey = labelToCategoryKey.get(node.label)
    if (!categoryKey) continue // renamed/custom category: no catalog suggestions available

    const realSubcatLabels = new Set(
      (realChildrenByParent.get(node.id) ?? []).filter((c) => c.kind === 'subcategory').map((c) => c.label.trim().toLowerCase())
    )

    const subcats = Array.from(
      new Set(
        catalog
          .filter((c) => c.category === categoryKey && !existingCatalogIds.has(c.id) && !notForMe.has(c.id))
          .map((c) => c.subcategory)
      )
    ).sort()

    for (const sub of subcats) {
      if (realSubcatLabels.has(sub.trim().toLowerCase())) continue // already a real node — step 2 handles its hobbies
      const ghostId = `ghostsub:${node.id}:${sub}`
      ghosts.push({ id: ghostId, parentRealOrGhostId: node.id, label: sub, level: 'subcategory', categoryKey, subcategory: sub })
      fauxNodes.push(makeFaux(ghostId, 'subcategory', sub, node.id, null, order++))
      if (expanded.has(ghostId)) pushHobbyGhosts(ghostId, categoryKey, sub)
    }
  }

  // Step 2: any real subcategory node, if expanded, reveals its own hobby
  // ghosts — independent of the parent category's expansion state.
  for (const node of realNodes) {
    if (node.kind !== 'subcategory' || !expanded.has(node.id)) continue
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined
    const categoryKey = parent ? labelToCategoryKey.get(parent.label) : undefined
    if (!categoryKey) continue
    pushHobbyGhosts(node.id, categoryKey, node.label)
  }

  return { fauxNodes, metaById: new Map(ghosts.map((g) => [g.id, g])) }
}

function makeFaux(id: string, kind: MapNode['kind'], label: string, parentId: string, catalogId: string | null, order: number): MapNode {
  return {
    id,
    user_id: 'ghost',
    kind,
    label,
    parent_id: parentId,
    catalog_id: catalogId,
    origin: 'suggested',
    status: null,
    notes: null,
    angle: null,
    created_at: `ghost-${String(order).padStart(4, '0')}`,
    updated_at: ''
  }
}

export function existingCatalogIdSet(snapshot: MapSnapshot): Set<string> {
  return new Set(snapshot.nodes.map((n) => n.catalog_id).filter((x): x is string => Boolean(x)))
}

export function notForMeSet(snapshot: MapSnapshot): Set<string> {
  return new Set(snapshot.suggestionStates.filter((s) => s.state === 'not_for_me').map((s) => s.catalog_id))
}
