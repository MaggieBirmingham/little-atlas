import { isDuplicateEdge } from './graph'
import type { BrainstormEntry, MapEdge, MapNode, MapSnapshot, Reflection, SuggestionState } from './types'
import { emptySnapshot } from './types'

export const GUEST_KEY = 'little-atlas:guest-snapshot:v1'
export const GUEST_BACKUP_KEY = `${GUEST_KEY}:unreadable-backup`

export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export type StorageResult = { ok: true } | { ok: false; error: string }

/** Where a guest's local draft lives. An interface so failures (blocked or
 * full storage, corrupt data) can be simulated in tests and surfaced in the UI. */
export interface GuestStorage {
  load(): { snapshot: MapSnapshot; error: string | null }
  save(snapshot: MapSnapshot): StorageResult
  clear(): StorageResult
  hasDraft(): boolean
}

function normalise(parsed: Partial<MapSnapshot>): MapSnapshot {
  const base = emptySnapshot()
  return {
    displayName: typeof parsed.displayName === 'string' && parsed.displayName ? parsed.displayName : base.displayName,
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    suggestionStates: Array.isArray(parsed.suggestionStates) ? parsed.suggestionStates : [],
    brainstorm: Array.isArray(parsed.brainstorm) ? parsed.brainstorm : [],
    reflections: Array.isArray(parsed.reflections) ? parsed.reflections : []
  }
}

export function createLocalGuestStorage(getStorage: () => Storage = () => localStorage): GuestStorage {
  function load(): { snapshot: MapSnapshot; error: string | null } {
    let raw: string | null
    try {
      raw = getStorage().getItem(GUEST_KEY)
    } catch (e) {
      return {
        snapshot: emptySnapshot(),
        error: `Your browser is blocking local storage (${describeError(e)}). A saved guest draft can't be read, and changes won't survive closing this tab.`
      }
    }
    if (raw === null) return { snapshot: emptySnapshot(), error: null }
    try {
      const parsed = JSON.parse(raw) as Partial<MapSnapshot> | null
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('unexpected shape')
      return { snapshot: normalise(parsed), error: null }
    } catch {
      let backedUp = false
      try {
        getStorage().setItem(GUEST_BACKUP_KEY, raw)
        backedUp = true
      } catch {
        backedUp = false
      }
      return {
        snapshot: emptySnapshot(),
        error: backedUp
          ? `Your saved guest draft could not be read. A copy of the raw data was kept in this browser under "${GUEST_BACKUP_KEY}".`
          : 'Your saved guest draft could not be read, and a backup copy could not be made.'
      }
    }
  }
  return {
    load,
    save(snapshot) {
      try {
        getStorage().setItem(GUEST_KEY, JSON.stringify(snapshot))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: describeError(e) }
      }
    },
    clear() {
      try {
        getStorage().removeItem(GUEST_KEY)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: describeError(e) }
      }
    },
    hasDraft() {
      const { snapshot } = load()
      return snapshot.nodes.length > 0 || snapshot.brainstorm.length > 0
    }
  }
}

export const guestStorage: GuestStorage = createLocalGuestStorage()

export interface MergePlan {
  nodesToInsert: MapNode[] // parents always before children
  edgesToInsert: MapEdge[]
  brainstormToInsert: BrainstormEntry[]
  reflectionsToInsert: Reflection[]
  suggestionStatesToInsert: SuggestionState[]
}

export function isEmptyPlan(plan: MergePlan): boolean {
  return (
    plan.nodesToInsert.length === 0 &&
    plan.edgesToInsert.length === 0 &&
    plan.brainstormToInsert.length === 0 &&
    plan.reflectionsToInsert.length === 0 &&
    plan.suggestionStatesToInsert.length === 0
  )
}

const clampLabel = (s: string) => s.trim().slice(0, 80) || 'Untitled'

/**
 * Pure: work out which of a guest's local rows are genuinely new for an
 * account, without touching anything. The plan is later applied in ONE
 * database transaction (see the import_guest_draft function), so an import
 * either lands completely or not at all.
 *  - Guest branches are matched to existing branches by label under the same
 *    parent (case/whitespace-insensitive) so nothing is duplicated.
 *  - Nodes are emitted parent-first; orphans/unreachable nodes are dropped.
 *  - Brainstorm lines, reflections and decisions are unioned and de-duplicated.
 */
export function planGuestMerge(remote: MapSnapshot, guest: MapSnapshot, userId: string): MergePlan {
  const nodesToInsert: MapNode[] = []
  const edgesToInsert: MapEdge[] = []
  const nowIso = new Date().toISOString()
  const workingNodes = [...remote.nodes]
  const guestIdToResolved = new Map<string, string>()

  const remoteCenter = workingNodes.find((n) => n.kind === 'center')
  const guestCenter = guest.nodes.find((n) => n.kind === 'center')

  let targetCenterId: string | null = remoteCenter?.id ?? null
  if (!remoteCenter && guestCenter) {
    const created: MapNode = {
      ...guestCenter,
      id: genId(),
      user_id: userId,
      label: clampLabel(guestCenter.label),
      parent_id: null,
      created_at: guestCenter.created_at || nowIso,
      updated_at: nowIso
    }
    nodesToInsert.push(created)
    workingNodes.push(created)
    targetCenterId = created.id
  }

  if (guestCenter && targetCenterId) {
    guestIdToResolved.set(guestCenter.id, targetCenterId)
    const childrenByParent = new Map<string, MapNode[]>()
    for (const n of guest.nodes) {
      if (n.kind === 'center' || !n.parent_id) continue
      if (!childrenByParent.has(n.parent_id)) childrenByParent.set(n.parent_id, [])
      childrenByParent.get(n.parent_id)!.push(n)
    }
    for (const list of childrenByParent.values()) {
      list.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id))
    }
    const visited = new Set<string>([guestCenter.id])
    const walk = (guestParentId: string) => {
      const resolvedParentId = guestIdToResolved.get(guestParentId)
      if (!resolvedParentId) return
      for (const child of childrenByParent.get(guestParentId) ?? []) {
        if (visited.has(child.id)) continue
        visited.add(child.id)
        const label = clampLabel(child.label)
        const existing = workingNodes.find(
          (n) => n.parent_id === resolvedParentId && n.label.trim().toLowerCase() === label.toLowerCase()
        )
        if (existing) {
          guestIdToResolved.set(child.id, existing.id)
        } else {
          const created: MapNode = {
            ...child,
            id: genId(),
            user_id: userId,
            label,
            parent_id: resolvedParentId,
            created_at: child.created_at || nowIso,
            updated_at: nowIso
          }
          guestIdToResolved.set(child.id, created.id)
          nodesToInsert.push(created)
          workingNodes.push(created)
        }
        walk(child.id)
      }
    }
    walk(guestCenter.id)
  }

  const workingEdges = [...remote.edges]
  for (const e of guest.edges) {
    const from = guestIdToResolved.get(e.from_node)
    const to = guestIdToResolved.get(e.to_node)
    if (!from || !to) continue
    if (isDuplicateEdge(workingEdges, from, to)) continue
    const resolved: MapEdge = { id: genId(), user_id: userId, from_node: from, to_node: to, created_at: nowIso }
    workingEdges.push(resolved)
    edgesToInsert.push(resolved)
  }

  const seenBrainstorm = new Set(remote.brainstorm.map((b) => b.text.trim().toLowerCase()))
  const brainstormToInsert: BrainstormEntry[] = []
  for (const b of guest.brainstorm) {
    const text = b.text.trim().slice(0, 280)
    if (!text || seenBrainstorm.has(text.toLowerCase())) continue
    seenBrainstorm.add(text.toLowerCase())
    brainstormToInsert.push({ ...b, id: genId(), user_id: userId, text, created_at: b.created_at || nowIso })
  }

  const reflectionsToInsert: Reflection[] = guest.reflections
    .filter((r) => r.text.trim())
    .map((r) => ({
      ...r,
      id: genId(),
      user_id: userId,
      text: r.text.trim().slice(0, 1000),
      node_id: r.node_id ? (guestIdToResolved.get(r.node_id) ?? null) : null,
      created_at: r.created_at || nowIso
    }))

  const decided = new Set(remote.suggestionStates.map((s) => s.catalog_id))
  const suggestionStatesToInsert: SuggestionState[] = []
  for (const s of guest.suggestionStates) {
    if (decided.has(s.catalog_id)) continue
    decided.add(s.catalog_id)
    suggestionStatesToInsert.push({ ...s, id: genId(), user_id: userId, created_at: s.created_at || nowIso })
  }

  return { nodesToInsert, edgesToInsert, brainstormToInsert, reflectionsToInsert, suggestionStatesToInsert }
}

