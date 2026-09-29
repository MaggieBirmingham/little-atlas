import type {
  BrainstormEntry,
  MapEdge,
  MapNode,
  MapSnapshot,
  Reflection,
  SuggestionState,
  SuggestionStateValue
} from './types'
import type { MergePlan } from './guestStore'

/** Everything the controller needs from the server. Every method either
 * resolves (the change is really stored) or throws an Error with a
 * human-readable message. There is no queue and no retry. */
export interface RemoteStore {
  loadAll(): Promise<MapSnapshot>
  insertNodes(nodes: MapNode[]): Promise<void>
  updateNode(id: string, patch: Partial<Pick<MapNode, 'label' | 'status' | 'notes' | 'parent_id'>>): Promise<void>
  deleteNode(id: string): Promise<void>
  insertEdge(edge: MapEdge): Promise<void>
  deleteEdge(id: string): Promise<void>
  upsertSuggestionState(catalogId: string, state: SuggestionStateValue): Promise<void>
  deleteSuggestionState(catalogId: string): Promise<void>
  insertBrainstorm(entry: BrainstormEntry): Promise<void>
  insertReflection(entry: Reflection): Promise<void>
  importGuestDraft(plan: MergePlan): Promise<void>
}

export interface DbResult {
  data: unknown
  error: { message: string } | null
}

/** The small slice of the Supabase query builder we use. Kept structural so
 * tests can supply a fake without the real client. */
export interface QueryLike extends PromiseLike<DbResult> {
  select(columns?: string): QueryLike
  eq(column: string, value: unknown): QueryLike
  order(column: string): QueryLike
  maybeSingle(): QueryLike
  insert(values: unknown): QueryLike
  update(values: unknown): QueryLike
  upsert(values: unknown, options?: { onConflict?: string }): QueryLike
  delete(): QueryLike
}

export interface DbClient {
  from(table: string): QueryLike
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<DbResult>
}

/** Awaits a query and throws unless it succeeded. With `requireRow`, also
 * throws when no row was affected: under Row Level Security a blocked or
 * missing-row UPDATE/DELETE returns no error, just zero rows. */
async function run(query: PromiseLike<DbResult>, what: string, requireRow = false): Promise<unknown> {
  const res = await query
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (requireRow && !(Array.isArray(res.data) && res.data.length > 0)) {
    throw new Error(`${what}: no matching row was changed (it may no longer exist, or you may not have permission)`)
  }
  return res.data
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

export function createSupabaseStore(client: DbClient, userId: string): RemoteStore {
  return {
    async loadAll() {
      const [profile, nodes, edges, states, brainstorm, reflections] = await Promise.all([
        run(client.from('profiles').select('*').eq('id', userId).maybeSingle(), 'Loading your profile'),
        run(client.from('nodes').select('*').eq('user_id', userId), 'Loading your map'),
        run(client.from('edges').select('*').eq('user_id', userId), 'Loading your links'),
        run(client.from('suggestion_state').select('*').eq('user_id', userId), 'Loading your saved suggestions'),
        run(client.from('brainstorm_entries').select('*').eq('user_id', userId).order('created_at'), 'Loading your brainstorm'),
        run(client.from('reflections').select('*').eq('user_id', userId).order('created_at'), 'Loading your reflections')
      ])
      const nodeRows = rows<MapNode>(nodes)
      const center = nodeRows.find((n) => n.kind === 'center')
      const profileName = (profile as { display_name?: string } | null)?.display_name
      return {
        displayName: center?.label ?? profileName ?? 'My Atlas',
        nodes: nodeRows,
        edges: rows<MapEdge>(edges),
        suggestionStates: rows<SuggestionState>(states),
        brainstorm: rows<BrainstormEntry>(brainstorm),
        reflections: rows<Reflection>(reflections)
      }
    },
    async insertNodes(nodes) {
      await run(client.from('nodes').insert(nodes), 'Saving to your map')
    },
    async updateNode(id, patch) {
      await run(client.from('nodes').update(patch).eq('id', id).select('id'), 'Updating your map', true)
    },
    async deleteNode(id) {
      await run(client.from('nodes').delete().eq('id', id).select('id'), 'Removing from your map', true)
    },
    async insertEdge(edge) {
      await run(client.from('edges').insert(edge), 'Saving the link')
    },
    async deleteEdge(id) {
      await run(client.from('edges').delete().eq('id', id).select('id'), 'Removing the link', true)
    },
    async upsertSuggestionState(catalogId, state) {
      await run(
        client.from('suggestion_state').upsert({ user_id: userId, catalog_id: catalogId, state }, { onConflict: 'user_id,catalog_id' }),
        'Saving your choice'
      )
    },
    async deleteSuggestionState(catalogId) {
      await run(client.from('suggestion_state').delete().eq('user_id', userId).eq('catalog_id', catalogId), 'Clearing your choice')
    },
    async insertBrainstorm(entry) {
      await run(client.from('brainstorm_entries').insert(entry), 'Saving your brainstorm entry')
    },
    async insertReflection(entry) {
      await run(client.from('reflections').insert(entry), 'Saving your reflection')
    },
    async importGuestDraft(plan) {
      // One RPC = one database transaction: everything lands, or nothing does.
      // user_id is deliberately not sent; the function uses auth.uid().
      const strip = <T extends { user_id: string }>(list: T[]) => list.map((row) => {
        const copy: Record<string, unknown> = { ...row }
        delete copy.user_id
        return copy
      })
      await run(
        client.rpc('import_guest_draft', {
          p_nodes: strip(plan.nodesToInsert),
          p_edges: strip(plan.edgesToInsert),
          p_brainstorm: strip(plan.brainstormToInsert),
          p_reflections: strip(plan.reflectionsToInsert),
          p_suggestions: strip(plan.suggestionStatesToInsert)
        }),
        'Importing your guest draft'
      )
    }
  }
}
