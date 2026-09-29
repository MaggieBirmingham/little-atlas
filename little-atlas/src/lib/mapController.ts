import {
  descendantIds,
  isDuplicateEdge,
  isDuplicateSibling,
  parentOptionsFor,
  wouldCreateCycle
} from './graph'
import { genId, isEmptyPlan, planGuestMerge, type GuestStorage } from './guestStore'
import { CATEGORY_LABELS, CATEGORY_ORDER } from './recommend'
import type { RemoteStore } from './remoteStore'
import type {
  BrainstormEntry,
  CatalogItem,
  MapEdge,
  MapNode,
  MapSnapshot,
  NodeKind,
  NodeOrigin,
  NodeStatus,
  Reflection,
  SuggestionStateValue
} from './types'
import { emptySnapshot } from './types'

export type Result = { ok: true; id?: string } | { ok: false; error: string }

export interface ControllerState {
  status: 'loading' | 'ready' | 'load_error'
  loadError: string | null
  pendingWrites: number
  /** Last failed change. Only ever says a change was NOT saved. */
  error: string | null
  /** Problems with this browser's local storage (guest mode only). */
  storageError: string | null
  snapshot: MapSnapshot
  hasPendingGuestDraft: boolean
}

export interface ControllerOptions {
  remote: RemoteStore | null // null = guest mode (local storage only)
  userId: string | null
  storage: GuestStorage
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const MAX_LABEL = 80

/**
 * All map state and every write, with no React in it so failure paths can be
 * tested directly.
 *
 * Signed in: a change is sent to the server FIRST; the local snapshot changes
 * only if the server confirmed it. On failure nothing changes locally and
 * `error` says the change was not saved. There is no retry queue, and nothing
 * here claims otherwise.
 * Guest: the change is applied and written to local storage; if storage
 * refuses, `storageError` says the change lives only in this tab.
 */
export class MapController {
  readonly isGuest: boolean
  private state: ControllerState
  private listeners = new Set<() => void>()
  private loadPromise: Promise<void> | null = null
  private seedPromise: Promise<void> | null = null
  private readonly opts: ControllerOptions

  constructor(opts: ControllerOptions) {
    this.opts = opts
    this.isGuest = opts.remote === null
    this.state = {
      status: 'loading',
      loadError: null,
      pendingWrites: 0,
      error: null,
      storageError: null,
      snapshot: emptySnapshot(),
      hasPendingGuestDraft: false
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = (): ControllerState => this.state

  private patch(partial: Partial<ControllerState>): void {
    this.state = { ...this.state, ...partial }
    for (const l of this.listeners) l()
  }

  private reject(error: string): Result {
    this.patch({ error })
    return { ok: false, error }
  }

  dismissError = (): void => {
    this.patch({ error: null })
  }

  // ---------------------------------------------------------------- loading
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise // StrictMode runs effects twice
    this.loadPromise = this.doLoad().finally(() => {
      this.loadPromise = null
    })
    return this.loadPromise
  }

  private async doLoad(): Promise<void> {
    this.patch({ status: 'loading', loadError: null })
    const { remote, storage } = this.opts
    if (!remote) {
      const { snapshot, error } = storage.load()
      this.patch({ snapshot, storageError: error, status: 'ready', hasPendingGuestDraft: false })
    } else {
      let snapshot: MapSnapshot
      try {
        snapshot = await remote.loadAll()
      } catch (e) {
        // Do NOT show an empty map here: it would look like the user's data is
        // gone and invite them to start a new one on top of it.
        this.patch({ status: 'load_error', loadError: `Couldn't load your map. ${messageOf(e)}` })
        return
      }
      this.patch({ snapshot, status: 'ready', hasPendingGuestDraft: storage.hasDraft() })
    }
    await this.ensureStarterCategories()
  }

  // ------------------------------------------------------------ write helper
  private applyLocal(mutator: (s: MapSnapshot) => MapSnapshot): void {
    const next = mutator(this.state.snapshot)
    this.patch({ snapshot: next })
    if (this.isGuest) {
      const saved = this.opts.storage.save(next)
      this.patch({
        storageError: saved.ok
          ? null
          : `This change couldn't be saved in your browser's storage (${saved.error}). It exists only in this tab and will be lost if you close or reload it. Use Settings → Export to keep a copy, or sign in.`
      })
    }
  }

  private async write(
    op: ((remote: RemoteStore) => Promise<void>) | null,
    failure: string,
    apply: (s: MapSnapshot) => MapSnapshot
  ): Promise<Result> {
    this.patch({ error: null })
    const { remote } = this.opts
    if (remote && op) {
      this.patch({ pendingWrites: this.state.pendingWrites + 1 })
      try {
        await op(remote)
      } catch (e) {
        const error = `${failure} ${messageOf(e)}. Nothing was changed.`
        this.patch({ error, pendingWrites: this.state.pendingWrites - 1 })
        return { ok: false, error }
      }
      this.patch({ pendingWrites: this.state.pendingWrites - 1 })
    }
    this.applyLocal(apply)
    return { ok: true }
  }

  private makeNode(kind: NodeKind, label: string, parentId: string | null, origin: NodeOrigin = 'personal', catalogId: string | null = null): MapNode {
    const now = new Date().toISOString()
    return {
      id: genId(),
      user_id: this.opts.userId ?? 'guest',
      kind,
      label,
      parent_id: parentId,
      catalog_id: catalogId,
      origin,
      status: null,
      notes: null,
      angle: null,
      created_at: now,
      updated_at: now
    }
  }

  private center(): MapNode | undefined {
    return this.state.snapshot.nodes.find((n) => n.kind === 'center')
  }

  // -------------------------------------------------------------- map setup
  startMap = async (name: string): Promise<Result> => {
    if (this.center()) return { ok: true }
    const label = name.trim().slice(0, 60) || 'My Atlas'
    const center = this.makeNode('center', label, null)
    const categories = CATEGORY_ORDER.map((key) => this.makeNode('category', CATEGORY_LABELS[key], center.id))
    const batch = [center, ...categories]
    // One INSERT statement: the centre and its 7 categories land together or not at all.
    return this.write((r) => r.insertNodes(batch), "Couldn't start your map.", (s) => ({ ...s, displayName: label, nodes: [...s.nodes, ...batch] }))
  }

  /** Repairs a map that has a centre but nothing else (e.g. an earlier attempt
   * was interrupted). Guarded so concurrent calls can't insert twice. */
  private ensureStarterCategories(): Promise<void> {
    if (this.seedPromise) return this.seedPromise
    const center = this.center()
    if (!center || this.state.snapshot.nodes.length !== 1) return Promise.resolve()
    const batch = CATEGORY_ORDER.map((key) => this.makeNode('category', CATEGORY_LABELS[key], center.id))
    this.seedPromise = this.write((r) => r.insertNodes(batch), "Couldn't set up your starter categories.", (s) => ({
      ...s,
      nodes: [...s.nodes, ...batch]
    })).then(() => undefined).finally(() => {
      this.seedPromise = null
    })
    return this.seedPromise
  }

  renameCenter = async (name: string): Promise<Result> => {
    const center = this.center()
    if (!center) return this.reject('Start your map first.')
    const label = name.trim().slice(0, 60)
    if (!label) return this.reject('Give your atlas a name.')
    return this.write((r) => r.updateNode(center.id, { label }), "Couldn't rename your atlas.", (s) => ({
      ...s,
      displayName: label,
      nodes: s.nodes.map((n) => (n.id === center.id ? { ...n, label } : n))
    }))
  }

  // ------------------------------------------------------------------ nodes
  addNode = async (input: { kind: NodeKind; label: string; parentId: string | null; origin?: NodeOrigin; catalogId?: string | null }): Promise<Result> => {
    const label = input.label.trim()
    if (!label) return this.reject('Give it a name first.')
    if (label.length > MAX_LABEL) return this.reject(`Names can be up to ${MAX_LABEL} characters.`)
    const { nodes } = this.state.snapshot
    if (input.parentId && !nodes.some((n) => n.id === input.parentId)) return this.reject('That branch no longer exists.')
    if (isDuplicateSibling(nodes, input.parentId, label)) return this.reject(`“${label}” is already on your map in this spot.`)
    const node = this.makeNode(input.kind, label, input.parentId, input.origin ?? 'personal', input.catalogId ?? null)
    const res = await this.write((r) => r.insertNodes([node]), `Couldn't add “${label}”.`, (s) => ({ ...s, nodes: [...s.nodes, node] }))
    return res.ok ? { ok: true, id: node.id } : res
  }

  /** Adds a catalog hobby, creating its category/subcategory first if needed, all in one statement. */
  addCatalogItem = async (item: CatalogItem): Promise<Result> => {
    const { nodes } = this.state.snapshot
    const center = this.center()
    if (!center) return this.reject('Start your map first.')
    if (nodes.some((n) => n.catalog_id === item.id)) return this.reject(`“${item.label}” is already on your map.`)

    const batch: MapNode[] = []
    const categoryLabel = CATEGORY_LABELS[item.category]
    let category = nodes.find((n) => n.kind === 'category' && n.label === categoryLabel)
    if (!category) {
      if (isDuplicateSibling(nodes, center.id, categoryLabel)) return this.reject(`Something called “${categoryLabel}” is already on your map.`)
      category = this.makeNode('category', categoryLabel, center.id)
      batch.push(category)
    }
    const categoryId = category.id
    let subcategory = nodes.find((n) => n.kind === 'subcategory' && n.parent_id === categoryId && n.label.toLowerCase() === item.subcategory.toLowerCase())
    if (!subcategory) {
      subcategory = this.makeNode('subcategory', item.subcategory, categoryId)
      batch.push(subcategory)
    }
    if (isDuplicateSibling(nodes, subcategory.id, item.label)) return this.reject(`“${item.label}” is already on your map in this spot.`)
    const hobby = this.makeNode('hobby', item.label, subcategory.id, 'personal', item.id)
    batch.push(hobby)

    const res = await this.write((r) => r.insertNodes(batch), `Couldn't add “${item.label}”.`, (s) => ({ ...s, nodes: [...s.nodes, ...batch] }))
    return res.ok ? { ok: true, id: hobby.id } : res
  }

  updateNode = async (id: string, patch: Partial<{ label: string; status: NodeStatus; notes: string | null }>): Promise<Result> => {
    const node = this.state.snapshot.nodes.find((n) => n.id === id)
    if (!node) return this.reject('That item no longer exists.')
    const next: typeof patch = { ...patch }
    if (patch.label !== undefined) {
      const label = patch.label.trim()
      if (!label) return this.reject('Give it a name.')
      if (label.length > MAX_LABEL) return this.reject(`Names can be up to ${MAX_LABEL} characters.`)
      if (isDuplicateSibling(this.state.snapshot.nodes, node.parent_id, label, id)) return this.reject(`You already have “${label}” here.`)
      next.label = label
    }
    const isCenter = node.kind === 'center'
    return this.write((r) => r.updateNode(id, next), `Couldn't save your change to “${node.label}”.`, (s) => ({
      ...s,
      displayName: isCenter && next.label ? next.label : s.displayName,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...next } : n))
    }))
  }

  moveNode = async (id: string, newParentId: string): Promise<Result> => {
    const { nodes } = this.state.snapshot
    const node = nodes.find((n) => n.id === id)
    if (!node || node.kind === 'center') return this.reject("That can't be moved.")
    const option = parentOptionsFor(nodes, node).find((o) => o.node.id === newParentId)
    if (!option) return this.reject(`“${node.label}” can't be moved there.`)
    if (!option.ok) return this.reject(`“${node.label}” can't be moved to “${option.node.label}”: ${option.reason}.`)
    return this.write((r) => r.updateNode(id, { parent_id: newParentId }), `Couldn't move “${node.label}”.`, (s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, parent_id: newParentId } : n))
    }))
  }

  deleteNode = async (id: string): Promise<Result> => {
    const { nodes } = this.state.snapshot
    const node = nodes.find((n) => n.id === id)
    if (!node) return this.reject('That item no longer exists.')
    if (node.kind === 'center') return this.reject("Your atlas's centre can't be removed. Delete your account in Settings to remove everything.")
    const gone = descendantIds(nodes, id)
    return this.write((r) => r.deleteNode(id), `Couldn't remove “${node.label}”.`, (s) => ({
      ...s,
      nodes: s.nodes.filter((n) => !gone.has(n.id)),
      edges: s.edges.filter((e) => !gone.has(e.from_node) && !gone.has(e.to_node)),
      // Mirrors the database: reflections stay, but lose their link to the node.
      reflections: s.reflections.map((x) => (x.node_id && gone.has(x.node_id) ? { ...x, node_id: null } : x))
    }))
  }

  // ------------------------------------------------------------ cross-links
  addEdge = async (fromId: string, toId: string): Promise<Result> => {
    const { nodes, edges } = this.state.snapshot
    const from = nodes.find((n) => n.id === fromId)
    const to = nodes.find((n) => n.id === toId)
    if (!from || !to) return this.reject('One of those items no longer exists.')
    if (from.kind === 'center' || to.kind === 'center') return this.reject("Your atlas's centre is already connected to everything.")
    if (isDuplicateEdge(edges, fromId, toId)) return this.reject(fromId === toId ? "An item can't be linked to itself." : 'These are already linked.')
    if (wouldCreateCycle(nodes, fromId, toId) || wouldCreateCycle(nodes, toId, fromId)) {
      return this.reject('These are already connected through the branches of your map.')
    }
    const edge: MapEdge = { id: genId(), user_id: this.opts.userId ?? 'guest', from_node: fromId, to_node: toId, created_at: new Date().toISOString() }
    return this.write((r) => r.insertEdge(edge), "Couldn't save the link.", (s) => ({ ...s, edges: [...s.edges, edge] }))
  }

  removeEdge = async (id: string): Promise<Result> => {
    if (!this.state.snapshot.edges.some((e) => e.id === id)) return this.reject('That link no longer exists.')
    return this.write((r) => r.deleteEdge(id), "Couldn't remove the link.", (s) => ({ ...s, edges: s.edges.filter((e) => e.id !== id) }))
  }

  // ---------------------------------------------------- suggestions & notes
  setSuggestionState = async (catalogId: string, state: SuggestionStateValue | null): Promise<Result> => {
    const previous = this.state.snapshot.suggestionStates.find((x) => x.catalog_id === catalogId)
    return this.write(
      (r) => (state ? r.upsertSuggestionState(catalogId, state) : r.deleteSuggestionState(catalogId)),
      "Couldn't save your choice.",
      (s) => ({
        ...s,
        suggestionStates: state
          ? [
              ...s.suggestionStates.filter((x) => x.catalog_id !== catalogId),
              { id: previous?.id ?? genId(), user_id: this.opts.userId ?? 'guest', catalog_id: catalogId, state, created_at: previous?.created_at ?? new Date().toISOString() }
            ]
          : s.suggestionStates.filter((x) => x.catalog_id !== catalogId)
      })
    )
  }

  addBrainstorm = async (text: string): Promise<Result> => {
    const trimmed = text.trim().slice(0, 280)
    if (!trimmed) return this.reject('Write something first.')
    const entry: BrainstormEntry = { id: genId(), user_id: this.opts.userId ?? 'guest', text: trimmed, created_at: new Date().toISOString() }
    return this.write((r) => r.insertBrainstorm(entry), "Couldn't save that entry.", (s) => ({ ...s, brainstorm: [...s.brainstorm, entry] }))
  }

  addReflection = async (text: string, nodeId: string | null): Promise<Result> => {
    const trimmed = text.trim().slice(0, 1000)
    if (!trimmed) return this.reject('Write something first.')
    if (nodeId && !this.state.snapshot.nodes.some((n) => n.id === nodeId)) return this.reject('That item no longer exists.')
    const entry: Reflection = { id: genId(), user_id: this.opts.userId ?? 'guest', node_id: nodeId, text: trimmed, created_at: new Date().toISOString() }
    return this.write((r) => r.insertReflection(entry), "Couldn't save your reflection.", (s) => ({ ...s, reflections: [...s.reflections, entry] }))
  }

  // ------------------------------------------------------------ guest import
  /**
   * Moves the local guest draft into the signed-in account. The server applies
   * it in ONE transaction, so a failure leaves the account untouched. The local
   * draft is removed only after the import is confirmed.
   */
  importGuestDraft = async (): Promise<Result> => {
    const { remote, userId, storage } = this.opts
    if (!remote || !userId) return this.reject('Sign in first.')
    const { snapshot: guest, error: readError } = storage.load()
    if (readError) return this.reject(`${readError} Nothing was imported.`)

    this.patch({ error: null, pendingWrites: this.state.pendingWrites + 1 })
    let refreshed: MapSnapshot
    try {
      try {
        const fresh = await remote.loadAll() // plan against the server's current data, not a stale copy
        const plan = planGuestMerge(fresh, guest, userId)
        if (!isEmptyPlan(plan)) await remote.importGuestDraft(plan)
      } catch (e) {
        const error = `Couldn't import your guest draft. ${messageOf(e)}. Nothing was imported, and your draft is still safe on this device.`
        this.patch({ error })
        return { ok: false, error }
      }
      try {
        refreshed = await remote.loadAll()
      } catch (e) {
        this.patch({ error: `Your guest draft WAS imported, but reloading your map failed (${messageOf(e)}). Refresh the page to see it.` })
        this.finishDraft()
        return { ok: true }
      }
    } finally {
      this.patch({ pendingWrites: this.state.pendingWrites - 1 })
    }
    this.patch({ snapshot: refreshed })
    this.finishDraft()
    return { ok: true }
  }

  private finishDraft(): void {
    const cleared = this.opts.storage.clear()
    if (cleared.ok) this.patch({ hasPendingGuestDraft: false })
    else {
      this.patch({
        hasPendingGuestDraft: true,
        storageError: `Your draft was imported, but the local copy couldn't be removed (${cleared.error}). It may be offered again; importing it again won't create duplicates.`
      })
    }
  }

  discardGuestDraft = (): Result => {
    const cleared = this.opts.storage.clear()
    if (!cleared.ok) return this.reject(`Couldn't remove the local draft: ${cleared.error}.`)
    this.patch({ hasPendingGuestDraft: false })
    return { ok: true }
  }

  exportJson = (): string => JSON.stringify(this.state.snapshot, null, 2)
}
