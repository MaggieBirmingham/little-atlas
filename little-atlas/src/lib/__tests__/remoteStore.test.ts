import { describe, expect, it } from 'vitest'
import { createSupabaseStore, type DbClient, type DbResult, type QueryLike } from '../remoteStore'
import { makeNode, resetNodeFactoryCounter } from '../../test/factories'
import type { MergePlan } from '../guestStore'

interface Call {
  table: string
  ops: string[]
  values?: unknown
}

/** A stand-in for the Supabase query builder. `respond` decides what each finished query returns. */
function fakeClient(respond: (call: Call) => DbResult) {
  const log: Call[] = []
  const rpcLog: Array<{ fn: string; args?: Record<string, unknown> }> = []
  let rpcResult: DbResult = { data: null, error: null }
  class Query implements QueryLike {
    private call: Call
    constructor(table: string) {
      this.call = { table, ops: [] }
    }
    private op(name: string, values?: unknown): QueryLike {
      this.call.ops.push(name)
      if (values !== undefined) this.call.values = values
      return this
    }
    select() { return this.op('select') }
    eq() { return this.op('eq') }
    order() { return this.op('order') }
    maybeSingle() { return this.op('maybeSingle') }
    insert(v: unknown) { return this.op('insert', v) }
    update(v: unknown) { return this.op('update', v) }
    upsert(v: unknown) { return this.op('upsert', v) }
    delete() { return this.op('delete') }
    then<A = DbResult, B = never>(onOk?: ((v: DbResult) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
      log.push(this.call)
      return Promise.resolve(respond(this.call)).then(onOk, onErr)
    }
  }
  const client: DbClient = {
    from: (table) => new Query(table),
    rpc: (fn, args) => {
      rpcLog.push({ fn, args })
      return Promise.resolve(rpcResult)
    }
  }
  return { client, log, rpcLog, setRpc: (r: DbResult) => { rpcResult = r } }
}

const ok = (data: unknown = null): DbResult => ({ data, error: null })
const fail = (message: string): DbResult => ({ data: null, error: { message } })

describe('createSupabaseStore: every returned error is surfaced', () => {
  it('loadAll assembles a snapshot and names the centre as the display name', async () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Sam’s Atlas' })
    const { client } = fakeClient((c) => (c.table === 'nodes' ? ok([center]) : c.table === 'profiles' ? ok({ display_name: 'Profile name' }) : ok([])))
    const snap = await createSupabaseStore(client, 'u1').loadAll()
    expect(snap.displayName).toBe('Sam’s Atlas')
    expect(snap.nodes).toHaveLength(1)
  })

  for (const table of ['profiles', 'nodes', 'edges', 'suggestion_state', 'brainstorm_entries', 'reflections']) {
    it(`loadAll throws if the ${table} query returns an error`, async () => {
      const { client } = fakeClient((c) => (c.table === table ? fail(`boom in ${table}`) : ok([])))
      let message = ''
      try {
        await createSupabaseStore(client, 'u1').loadAll()
      } catch (e) {
        message = (e as Error).message
      }
      expect(message).toMatch(new RegExp(`boom in ${table}`))
    })
  }

  it('insertNodes throws with the server message', async () => {
    const { client } = fakeClient(() => fail('duplicate key value violates unique constraint'))
    let message = ''
    try {
      await createSupabaseStore(client, 'u1').insertNodes([makeNode({ kind: 'custom', label: 'x' })])
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/duplicate key/)
  })

  it('updateNode and deleteNode treat "no row affected" (what RLS returns for a blocked change) as a failure', async () => {
    const { client } = fakeClient(() => ok([]))
    const store = createSupabaseStore(client, 'u1')
    let updateMsg = ''
    let deleteMsg = ''
    try { await store.updateNode('n1', { label: 'x' }) } catch (e) { updateMsg = (e as Error).message }
    try { await store.deleteNode('n1') } catch (e) { deleteMsg = (e as Error).message }
    expect(updateMsg).toMatch(/no matching row/)
    expect(deleteMsg).toMatch(/no matching row/)
  })

  it('updateNode, deleteNode and deleteEdge succeed when a row was affected', async () => {
    const { client } = fakeClient(() => ok([{ id: 'n1' }]))
    const store = createSupabaseStore(client, 'u1')
    await store.updateNode('n1', { label: 'x' })
    await store.deleteNode('n1')
    await store.deleteEdge('e1')
    expect(true).toBe(true)
  })

  it('deleteEdge fails on zero rows; clearing a suggestion decision does not (nothing to clear is fine)', async () => {
    const { client } = fakeClient(() => ok([]))
    const store = createSupabaseStore(client, 'u1')
    let msg = ''
    try { await store.deleteEdge('e1') } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/no matching row/)
    await store.deleteSuggestionState('movement-walking')
    expect(true).toBe(true)
  })

  it('importGuestDraft sends one RPC without user_id and throws if the RPC errors', async () => {
    resetNodeFactoryCounter()
    const node = makeNode({ kind: 'category', label: 'Movement', user_id: 'guest-should-not-be-sent' })
    const plan: MergePlan = { nodesToInsert: [node], edgesToInsert: [], brainstormToInsert: [], reflectionsToInsert: [], suggestionStatesToInsert: [] }
    const ctx = fakeClient(() => ok())
    const store = createSupabaseStore(ctx.client, 'u1')
    await store.importGuestDraft(plan)
    expect(ctx.rpcLog).toHaveLength(1)
    expect(ctx.rpcLog[0].fn).toBe('import_guest_draft')
    const sent = (ctx.rpcLog[0].args as { p_nodes: Array<Record<string, unknown>> }).p_nodes
    expect(sent[0].label).toBe('Movement')
    expect('user_id' in sent[0]).toBe(false)

    ctx.setRpc(fail('rolled back: duplicate key'))
    let msg = ''
    try { await store.importGuestDraft(plan) } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/rolled back/)
  })
})
