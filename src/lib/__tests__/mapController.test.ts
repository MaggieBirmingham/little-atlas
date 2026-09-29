import { describe, expect, it } from 'vitest'
import { MapController } from '../mapController'
import { CATEGORY_ORDER } from '../recommend'
import { makeNode, resetNodeFactoryCounter } from '../../test/factories'
import { FakeRemote, FakeStorage } from '../../test/fakes'
import catalogSeed from '../../data/catalogSeed.json'
import { emptySnapshot } from '../types'
import type { CatalogItem, MapSnapshot } from '../types'

const CATALOG = catalogSeed as CatalogItem[]
const item = (id: string) => CATALOG.find((c) => c.id === id)!

function signedIn() {
  const remote = new FakeRemote()
  const storage = new FakeStorage()
  const controller = new MapController({ remote, userId: 'user-1', storage })
  return { remote, storage, controller }
}
function guest() {
  const storage = new FakeStorage()
  const controller = new MapController({ remote: null, userId: null, storage })
  return { storage, controller }
}
const nodeByLabel = (c: MapController, label: string) => c.getState().snapshot.nodes.find((n) => n.label === label)!

describe('signed-in writes: server first, local state only after it succeeds', () => {
  it('startMap sends the centre and all 7 categories in ONE insert', async () => {
    const { remote, controller } = signedIn()
    const res = await controller.startMap('Atlas')
    expect(res.ok).toBe(true)
    expect(remote.callsTo('insertNodes')).toHaveLength(1)
    expect((remote.callsTo('insertNodes')[0].args[0] as unknown[]).length).toBe(1 + CATEGORY_ORDER.length)
    expect(controller.getState().snapshot.nodes).toHaveLength(8)
    expect(controller.getState().snapshot.displayName).toBe('Atlas')
  })

  it('a failed insert changes nothing locally and never claims the change is stored or will retry', async () => {
    const { remote, controller } = signedIn()
    await controller.startMap('Atlas')
    const before = controller.getState().snapshot
    remote.failing.add('insertNodes')
    const res = await controller.addNode({ kind: 'custom', label: 'Pottery', parentId: nodeByLabel(controller, 'Atlas').id })
    expect(res.ok).toBe(false)
    expect(controller.getState().snapshot).toBe(before) // untouched: same object
    const error = controller.getState().error ?? ''
    expect(error).toMatch(/Nothing was changed/)
    expect(error).not.toMatch(/retry|try again when|kept on this device|saved locally|will be saved/i)
    expect(controller.getState().pendingWrites).toBe(0)
  })

  it('a failed rename, status change, and delete each leave the map exactly as it was', async () => {
    const { remote, controller } = signedIn()
    await controller.startMap('Atlas')
    const add = await controller.addNode({ kind: 'custom', label: 'Pottery', parentId: nodeByLabel(controller, 'Atlas').id })
    const before = controller.getState().snapshot
    remote.failing.add('updateNode')
    remote.failing.add('deleteNode')
    expect((await controller.updateNode(add.ok ? add.id! : '', { label: 'Ceramics' })).ok).toBe(false)
    expect((await controller.updateNode(add.ok ? add.id! : '', { status: 'trying' })).ok).toBe(false)
    expect((await controller.deleteNode(add.ok ? add.id! : '')).ok).toBe(false)
    expect(controller.getState().snapshot).toBe(before)
  })

  it('a failed suggestion decision, brainstorm entry and reflection are not applied', async () => {
    const { remote, controller } = signedIn()
    await controller.startMap('Atlas')
    remote.failing.add('upsertSuggestionState')
    remote.failing.add('insertBrainstorm')
    remote.failing.add('insertReflection')
    expect((await controller.setSuggestionState('movement-walking', 'saved_for_later')).ok).toBe(false)
    expect((await controller.addBrainstorm('pottery')).ok).toBe(false)
    expect((await controller.addReflection('hello', null)).ok).toBe(false)
    const s = controller.getState().snapshot
    expect(s.suggestionStates).toHaveLength(0)
    expect(s.brainstorm).toHaveLength(0)
    expect(s.reflections).toHaveLength(0)
  })

  it('applies the change once the server has confirmed it', async () => {
    const { controller } = signedIn()
    await controller.startMap('Atlas')
    const res = await controller.addNode({ kind: 'custom', label: 'Pottery', parentId: nodeByLabel(controller, 'Atlas').id })
    expect(res.ok).toBe(true)
    expect(nodeByLabel(controller, 'Pottery')).toBeDefined()
    expect(controller.getState().error).toBeNull()
  })

  it('rejects duplicates and empty names before contacting the server', async () => {
    const { remote, controller } = signedIn()
    await controller.startMap('Atlas')
    const calls = remote.calls.length
    const center = nodeByLabel(controller, 'Atlas')
    expect((await controller.addNode({ kind: 'custom', label: '  movement ', parentId: center.id })).ok).toBe(false)
    expect((await controller.addNode({ kind: 'custom', label: '   ', parentId: center.id })).ok).toBe(false)
    expect(remote.calls.length).toBe(calls)
  })
})

describe('loading', () => {
  it('a failed load shows a load error, not an empty map, and does not try to seed anything', async () => {
    const { remote, controller } = signedIn()
    remote.failing.add('loadAll')
    await controller.load()
    const s = controller.getState()
    expect(s.status).toBe('load_error')
    expect(s.loadError).toMatch(/Couldn't load your map/)
    expect(remote.callsTo('insertNodes')).toHaveLength(0)
  })

  it('load can be retried after a failure', async () => {
    const { remote, controller } = signedIn()
    remote.failing.add('loadAll')
    await controller.load()
    remote.failing.delete('loadAll')
    const center = makeNode({ kind: 'center', label: 'Me', user_id: 'user-1' })
    const cats = CATEGORY_ORDER.map((_, i) => makeNode({ kind: 'category', label: `Cat ${i}`, parent_id: center.id, user_id: 'user-1' }))
    remote.serverSnapshot = { ...emptySnapshot('Me'), nodes: [center, ...cats] }
    await controller.load()
    expect(controller.getState().status).toBe('ready')
    expect(controller.getState().loadError).toBeNull()
    expect(controller.getState().snapshot.nodes).toHaveLength(8)
  })

  it('repairs a centre-only map by adding the categories exactly once, even if load is called twice at once', async () => {
    const { remote, controller } = signedIn()
    const center = makeNode({ kind: 'center', label: 'Me', user_id: 'user-1' })
    remote.serverSnapshot = { ...emptySnapshot('Me'), nodes: [center] }
    await Promise.all([controller.load(), controller.load()])
    expect(remote.callsTo('insertNodes')).toHaveLength(1)
    expect(controller.getState().snapshot.nodes).toHaveLength(1 + CATEGORY_ORDER.length)
  })

  it('does not re-add categories to a map the person has already customised', async () => {
    const { remote, controller } = signedIn()
    const center = makeNode({ kind: 'center', label: 'Me', user_id: 'user-1' })
    const mine = makeNode({ kind: 'custom', label: 'Pottery', parent_id: center.id, user_id: 'user-1' })
    remote.serverSnapshot = { ...emptySnapshot('Me'), nodes: [center, mine] }
    await controller.load()
    expect(remote.callsTo('insertNodes')).toHaveLength(0)
  })
})

describe('moving, deleting, and linking', () => {
  async function seeded() {
    const ctx = signedIn()
    await ctx.controller.startMap('Atlas')
    await ctx.controller.addCatalogItem(item('movement-walking'))
    await ctx.controller.addCatalogItem(item('nature-birdwatching'))
    return ctx
  }

  it('moves an interest to another subcategory (server first) and updates its parent', async () => {
    const { remote, controller } = await seeded()
    const walking = nodeByLabel(controller, 'Everyday walking')
    const observing = nodeByLabel(controller, 'Observing wildlife')
    const res = await controller.moveNode(walking.id, observing.id)
    expect(res.ok).toBe(true)
    expect(remote.callsTo('updateNode').at(-1)?.args).toEqual([walking.id, { parent_id: observing.id }])
    expect(nodeByLabel(controller, 'Everyday walking').parent_id).toBe(observing.id)
  })

  it('refuses a move to a place that already has the same name, and does not call the server', async () => {
    const { remote, controller } = await seeded()
    const walking = nodeByLabel(controller, 'Everyday walking')
    const observing = nodeByLabel(controller, 'Observing wildlife')
    await controller.addNode({ kind: 'custom', label: 'everyday walking', parentId: observing.id })
    const calls = remote.callsTo('updateNode').length
    const res = await controller.moveNode(walking.id, observing.id)
    expect(res.ok).toBe(false)
    expect(remote.callsTo('updateNode').length).toBe(calls)
  })

  it('does not move the centre', async () => {
    const { controller } = await seeded()
    const center = nodeByLabel(controller, 'Atlas')
    expect((await controller.moveNode(center.id, nodeByLabel(controller, 'Nature').id)).ok).toBe(false)
  })

  it('a failed move leaves the interest where it was', async () => {
    const { remote, controller } = await seeded()
    const walking = nodeByLabel(controller, 'Everyday walking')
    const parentBefore = walking.parent_id
    remote.failing.add('updateNode')
    const res = await controller.moveNode(walking.id, nodeByLabel(controller, 'Observing wildlife').id)
    expect(res.ok).toBe(false)
    expect(nodeByLabel(controller, 'Everyday walking').parent_id).toBe(parentBefore)
  })

  it('deleting a branch removes its descendants and links, and detaches (but keeps) reflections', async () => {
    const { controller } = await seeded()
    const walking = nodeByLabel(controller, 'Everyday walking')
    const birds = nodeByLabel(controller, 'Casual bird watching')
    await controller.addEdge(walking.id, birds.id)
    await controller.addReflection('my first walk', walking.id)
    const movement = nodeByLabel(controller, 'Movement')
    const res = await controller.deleteNode(movement.id)
    expect(res.ok).toBe(true)
    const s = controller.getState().snapshot
    expect(s.nodes.find((n) => n.label === 'Everyday walking')).toBeUndefined()
    expect(s.edges).toHaveLength(0)
    expect(s.reflections).toHaveLength(1)
    expect(s.reflections[0].node_id).toBeNull()
  })

  it('creates and removes a cross-link, refusing duplicates, self-links, and ancestor links', async () => {
    const { controller } = await seeded()
    const walking = nodeByLabel(controller, 'Everyday walking')
    const birds = nodeByLabel(controller, 'Casual bird watching')
    expect((await controller.addEdge(walking.id, birds.id)).ok).toBe(true)
    expect((await controller.addEdge(birds.id, walking.id)).ok).toBe(false) // same link, other direction
    expect((await controller.addEdge(walking.id, walking.id)).ok).toBe(false)
    expect((await controller.addEdge(walking.id, nodeByLabel(controller, 'Movement').id)).ok).toBe(false) // its own ancestor
    const edgeId = controller.getState().snapshot.edges[0].id
    expect((await controller.removeEdge(edgeId)).ok).toBe(true)
    expect(controller.getState().snapshot.edges).toHaveLength(0)
  })

  it('addCatalogItem creates missing ancestors in the same single insert, and refuses a second add', async () => {
    const { remote, controller } = signedIn()
    await controller.startMap('Atlas')
    const before = remote.callsTo('insertNodes').length
    const res = await controller.addCatalogItem(item('movement-walking'))
    expect(res.ok).toBe(true)
    const batch = remote.callsTo('insertNodes').at(-1)!.args[0] as Array<{ kind: string }>
    expect(remote.callsTo('insertNodes').length).toBe(before + 1)
    expect(batch.map((n) => n.kind)).toEqual(['subcategory', 'hobby']) // Movement already existed
    expect((await controller.addCatalogItem(item('movement-walking'))).ok).toBe(false)
  })
})

describe('guest mode and local storage', () => {
  it('writes every change to local storage', async () => {
    const { storage, controller } = guest()
    await controller.startMap('Atlas')
    expect(storage.saves).toBeGreaterThan(0)
    expect(storage.snapshot.nodes).toHaveLength(8)
  })

  it('surfaces a storage failure and says the change lives only in this tab', async () => {
    const { storage, controller } = guest()
    await controller.startMap('Atlas')
    storage.failSave = 'QuotaExceededError'
    const res = await controller.addNode({ kind: 'custom', label: 'Pottery', parentId: nodeByLabel(controller, 'Atlas').id })
    expect(res.ok).toBe(true) // still usable in this tab
    const message = controller.getState().storageError ?? ''
    expect(message).toMatch(/QuotaExceededError/)
    expect(message).toMatch(/only in this tab/)
    expect(nodeByLabel(controller, 'Pottery')).toBeDefined()
  })

  it('clears the storage warning once saving works again', async () => {
    const { storage, controller } = guest()
    await controller.startMap('Atlas')
    storage.failSave = 'blocked'
    await controller.addNode({ kind: 'custom', label: 'One', parentId: nodeByLabel(controller, 'Atlas').id })
    expect(controller.getState().storageError).not.toBeNull()
    storage.failSave = null
    await controller.addNode({ kind: 'custom', label: 'Two', parentId: nodeByLabel(controller, 'Atlas').id })
    expect(controller.getState().storageError).toBeNull()
  })

  it('reports an unreadable or blocked draft on load', async () => {
    const { storage, controller } = guest()
    storage.loadError = 'Your saved guest draft could not be read.'
    await controller.load()
    expect(controller.getState().storageError).toMatch(/could not be read/)
    expect(controller.getState().status).toBe('ready')
  })
})

describe('guest draft import is all-or-nothing', () => {
  function guestDraft(): MapSnapshot {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest', user_id: 'guest' })
    const gCat = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const gHobby = makeNode({ kind: 'hobby', label: 'Couch to 5k', parent_id: gCat.id, user_id: 'guest' })
    return { ...emptySnapshot('Guest'), nodes: [gCenter, gCat, gHobby], brainstorm: [{ id: 'b', user_id: 'guest', text: 'running', created_at: 'now' }] }
  }
  async function ready() {
    const remote = new FakeRemote()
    const storage = new FakeStorage(guestDraft())
    const controller = new MapController({ remote, userId: 'user-1', storage })
    const center = makeNode({ kind: 'center', label: 'Me', user_id: 'user-1' })
    const cats = CATEGORY_ORDER.map((_, i) => makeNode({ kind: 'category', label: i === 0 ? 'Movement' : `Cat ${i}`, parent_id: center.id, user_id: 'user-1' }))
    remote.serverSnapshot = { ...emptySnapshot('Me'), nodes: [center, ...cats] }
    await controller.load()
    return { remote, storage, controller }
  }

  it('offers the draft after sign-in, imports it in one call, then removes the local copy', async () => {
    const { remote, storage, controller } = await ready()
    expect(controller.getState().hasPendingGuestDraft).toBe(true)
    const res = await controller.importGuestDraft()
    expect(res.ok).toBe(true)
    expect(remote.callsTo('importGuestDraft')).toHaveLength(1)
    expect(remote.importedPlans[0].nodesToInsert.map((n) => n.label)).toEqual(['Couch to 5k'])
    expect(storage.hasDraft()).toBe(false)
    expect(controller.getState().hasPendingGuestDraft).toBe(false)
    expect(controller.getState().snapshot.nodes.some((n) => n.label === 'Couch to 5k')).toBe(true)
  })

  it('if the server rejects the import, nothing is imported and the local draft is kept', async () => {
    const { remote, storage, controller } = await ready()
    const nodesBefore = controller.getState().snapshot.nodes
    remote.failing.add('importGuestDraft')
    const res = await controller.importGuestDraft()
    expect(res.ok).toBe(false)
    expect(controller.getState().error).toMatch(/Nothing was imported/)
    expect(storage.hasDraft()).toBe(true)
    expect(controller.getState().hasPendingGuestDraft).toBe(true)
    expect(controller.getState().snapshot.nodes).toBe(nodesBefore)
  })

  it('a retry after a failed import succeeds and does not duplicate anything', async () => {
    const { remote, controller } = await ready()
    remote.failing.add('importGuestDraft')
    await controller.importGuestDraft()
    remote.failing.delete('importGuestDraft')
    expect((await controller.importGuestDraft()).ok).toBe(true)
    const labels = controller.getState().snapshot.nodes.map((n) => n.label)
    expect(labels.filter((l) => l === 'Couch to 5k')).toHaveLength(1)
    expect(labels.filter((l) => l === 'Movement')).toHaveLength(1)
  })

  it('if the import lands but the refresh fails, says the draft WAS imported (not that nothing was)', async () => {
    const { remote, storage, controller } = await ready()
    remote.failLoadFromCall = remote.loadCount + 2 // fresh plan-load succeeds, post-import reload fails
    const res = await controller.importGuestDraft()
    expect(res.ok).toBe(true)
    expect(controller.getState().error).toMatch(/WAS imported/)
    expect(storage.hasDraft()).toBe(false)
  })

  it('does not touch anything if the local draft cannot be read', async () => {
    const { remote, storage, controller } = await ready()
    storage.loadError = 'unreadable'
    const res = await controller.importGuestDraft()
    expect(res.ok).toBe(false)
    expect(remote.callsTo('importGuestDraft')).toHaveLength(0)
  })

  it('reports it if the local copy cannot be removed after a successful import', async () => {
    const { storage, controller } = await ready()
    storage.failClear = 'locked'
    const res = await controller.importGuestDraft()
    expect(res.ok).toBe(true)
    expect(controller.getState().storageError).toMatch(/couldn't be removed/)
    expect(controller.getState().hasPendingGuestDraft).toBe(true)
  })

  it('does nothing when signed out', async () => {
    const { controller } = guest()
    expect((await controller.importGuestDraft()).ok).toBe(false)
  })
})
