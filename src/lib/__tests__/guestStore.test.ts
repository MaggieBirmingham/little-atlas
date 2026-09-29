import { describe, expect, it } from 'vitest'
import { GUEST_BACKUP_KEY, GUEST_KEY, createLocalGuestStorage, isEmptyPlan, planGuestMerge } from '../guestStore'
import { makeNode, resetNodeFactoryCounter } from '../../test/factories'
import { emptySnapshot } from '../types'
import type { MapSnapshot } from '../types'

describe('planGuestMerge', () => {
  it('adopts the whole guest tree wholesale when the account has no map yet', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest Atlas', user_id: 'guest' })
    const gCategory = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest Atlas'), nodes: [gCenter, gCategory] }
    const remote = emptySnapshot()

    const plan = planGuestMerge(remote, guest, 'user-1')

    expect(plan.nodesToInsert).toHaveLength(2)
    const center = plan.nodesToInsert.find((n) => n.kind === 'center')!
    const category = plan.nodesToInsert.find((n) => n.kind === 'category')!
    expect(center.user_id).toBe('user-1')
    expect(category.parent_id).toBe(center.id) // re-mapped to the freshly generated id, not the old guest id
    expect(category.user_id).toBe('user-1')
  })

  it('does not duplicate a category the account already has under the same center', () => {
    resetNodeFactoryCounter()
    const rCenter = makeNode({ kind: 'center', label: 'My Atlas', user_id: 'user-1' })
    const rCategory = makeNode({ kind: 'category', label: 'Movement', parent_id: rCenter.id, user_id: 'user-1' })
    const remote: MapSnapshot = { ...emptySnapshot('My Atlas'), nodes: [rCenter, rCategory] }

    const gCenter = makeNode({ kind: 'center', label: 'Guest Atlas', user_id: 'guest' })
    const gCategory = makeNode({ kind: 'category', label: '  movement ', parent_id: gCenter.id, user_id: 'guest' }) // different case/whitespace
    const guest: MapSnapshot = { ...emptySnapshot('Guest Atlas'), nodes: [gCenter, gCategory] }

    const plan = planGuestMerge(remote, guest, 'user-1')

    expect(plan.nodesToInsert).toHaveLength(0) // the category matched an existing one and was skipped
  })

  it('adds a genuinely new branch under the resolved existing category, not a duplicate category', () => {
    resetNodeFactoryCounter()
    const rCenter = makeNode({ kind: 'center', label: 'My Atlas', user_id: 'user-1' })
    const rCategory = makeNode({ kind: 'category', label: 'Movement', parent_id: rCenter.id, user_id: 'user-1' })
    const remote: MapSnapshot = { ...emptySnapshot('My Atlas'), nodes: [rCenter, rCategory] }

    const gCenter = makeNode({ kind: 'center', label: 'Guest Atlas', user_id: 'guest' })
    const gCategory = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const gHobby = makeNode({ kind: 'hobby', label: 'Couch to 5k', parent_id: gCategory.id, user_id: 'guest', catalog_id: 'movement-couch-to-5k' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest Atlas'), nodes: [gCenter, gCategory, gHobby] }

    const plan = planGuestMerge(remote, guest, 'user-1')

    expect(plan.nodesToInsert).toHaveLength(1)
    expect(plan.nodesToInsert[0].label).toBe('Couch to 5k')
    expect(plan.nodesToInsert[0].parent_id).toBe(rCategory.id) // attached under the EXISTING category, not a new one
    expect(plan.nodesToInsert[0].user_id).toBe('user-1')
  })

  it('remaps cross-link edges to the resolved node ids and drops unresolved ones', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest Atlas', user_id: 'guest' })
    const gCategoryA = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const gCategoryB = makeNode({ kind: 'category', label: 'Nature', parent_id: gCenter.id, user_id: 'guest' })
    const guest: MapSnapshot = {
      ...emptySnapshot('Guest Atlas'),
      nodes: [gCenter, gCategoryA, gCategoryB],
      edges: [{ id: 'e1', user_id: 'guest', from_node: gCategoryA.id, to_node: gCategoryB.id, created_at: 'now' }]
    }
    const remote = emptySnapshot()

    const plan = planGuestMerge(remote, guest, 'user-1')
    expect(plan.edgesToInsert).toHaveLength(1)
    const newA = plan.nodesToInsert.find((n) => n.label === 'Movement')!
    const newB = plan.nodesToInsert.find((n) => n.label === 'Nature')!
    expect(plan.edgesToInsert[0].from_node).toBe(newA.id)
    expect(plan.edgesToInsert[0].to_node).toBe(newB.id)
    expect(plan.edgesToInsert[0].user_id).toBe('user-1')
  })

  it('de-duplicates brainstorm entries by exact (trimmed, case-insensitive) text', () => {
    const remote: MapSnapshot = { ...emptySnapshot(), brainstorm: [{ id: 'b1', user_id: 'user-1', text: 'pottery', created_at: 'now' }] }
    const guest: MapSnapshot = {
      ...emptySnapshot(),
      brainstorm: [
        { id: 'g1', user_id: 'guest', text: ' Pottery ', created_at: 'now' },
        { id: 'g2', user_id: 'guest', text: 'birdwatching', created_at: 'now' }
      ]
    }
    const plan = planGuestMerge(remote, guest, 'user-1')
    expect(plan.brainstormToInsert).toHaveLength(1)
    expect(plan.brainstormToInsert[0].text).toBe('birdwatching')
    expect(plan.brainstormToInsert[0].user_id).toBe('user-1')
  })

  it('does not import a suggestion-state decision for a catalog item the account already has a decision on', () => {
    const remote: MapSnapshot = {
      ...emptySnapshot(),
      suggestionStates: [{ id: 's1', user_id: 'user-1', catalog_id: 'movement-walking', state: 'not_for_me', created_at: 'now' }]
    }
    const guest: MapSnapshot = {
      ...emptySnapshot(),
      suggestionStates: [
        { id: 'g1', user_id: 'guest', catalog_id: 'movement-walking', state: 'saved_for_later', created_at: 'now' },
        { id: 'g2', user_id: 'guest', catalog_id: 'nature-hiking', state: 'saved_for_later', created_at: 'now' }
      ]
    }
    const plan = planGuestMerge(remote, guest, 'user-1')
    expect(plan.suggestionStatesToInsert).toHaveLength(1)
    expect(plan.suggestionStatesToInsert[0].catalog_id).toBe('nature-hiking')
  })

  it('remaps a reflection\u2019s node_id to the resolved id, or null if it cannot be resolved', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest Atlas', user_id: 'guest' })
    const gHobby = makeNode({ kind: 'hobby', label: 'Sketching', parent_id: gCenter.id, user_id: 'guest' })
    const guest: MapSnapshot = {
      ...emptySnapshot('Guest Atlas'),
      nodes: [gCenter, gHobby],
      reflections: [{ id: 'r1', user_id: 'guest', node_id: gHobby.id, text: 'Enjoyed it', created_at: 'now' }]
    }
    const remote = emptySnapshot()
    const plan = planGuestMerge(remote, guest, 'user-1')
    const newHobby = plan.nodesToInsert.find((n) => n.label === 'Sketching')!
    expect(plan.reflectionsToInsert[0].node_id).toBe(newHobby.id)
    expect(plan.reflectionsToInsert[0].user_id).toBe('user-1')
  })
})

describe('planGuestMerge ordering and safety', () => {
  it('emits parents before children even when the guest array is in a shuffled order', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest', user_id: 'guest' })
    const gCat = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const gSub = makeNode({ kind: 'subcategory', label: 'Cardio', parent_id: gCat.id, user_id: 'guest' })
    const gHobby = makeNode({ kind: 'hobby', label: 'Walking', parent_id: gSub.id, user_id: 'guest' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest'), nodes: [gHobby, gSub, gCat, gCenter] }
    const plan = planGuestMerge(emptySnapshot(), guest, 'user-1')
    const order = plan.nodesToInsert.map((n) => n.label)
    expect(order).toEqual(['Guest', 'Movement', 'Cardio', 'Walking'])
    const seen = new Set<string>()
    for (const n of plan.nodesToInsert) {
      if (n.parent_id) expect(seen.has(n.parent_id)).toBe(true)
      seen.add(n.id)
    }
  })

  it('drops guest nodes whose parent cannot be found instead of producing a row the database would reject', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest', user_id: 'guest' })
    const orphan = makeNode({ kind: 'hobby', label: 'Orphan', parent_id: 'missing', user_id: 'guest' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest'), nodes: [gCenter, orphan] }
    const plan = planGuestMerge(emptySnapshot(), guest, 'user-1')
    expect(plan.nodesToInsert.map((n) => n.label)).toEqual(['Guest'])
  })

  it('collapses duplicate sibling labels inside the guest draft itself', () => {
    resetNodeFactoryCounter()
    const gCenter = makeNode({ kind: 'center', label: 'Guest', user_id: 'guest' })
    const a = makeNode({ kind: 'category', label: 'Movement', parent_id: gCenter.id, user_id: 'guest' })
    const b = makeNode({ kind: 'category', label: ' movement', parent_id: gCenter.id, user_id: 'guest' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest'), nodes: [gCenter, a, b] }
    const plan = planGuestMerge(emptySnapshot(), guest, 'user-1')
    expect(plan.nodesToInsert.filter((n) => n.kind === 'category')).toHaveLength(1)
  })

  it('produces an empty plan when everything is already in the account', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me', user_id: 'user-1' })
    const remote: MapSnapshot = { ...emptySnapshot('Me'), nodes: [center] }
    const gCenter = makeNode({ kind: 'center', label: 'Guest', user_id: 'guest' })
    const guest: MapSnapshot = { ...emptySnapshot('Guest'), nodes: [gCenter] }
    expect(isEmptyPlan(planGuestMerge(remote, guest, 'user-1'))).toBe(true)
  })
})

describe('local guest storage failures are reported, not swallowed', () => {
  function fakeStorage(overrides: Partial<Storage> = {}): Storage {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
      ...overrides
    } as Storage
  }

  it('save() returns the error when the browser refuses the write', () => {
    const store = createLocalGuestStorage(() => fakeStorage({ setItem: () => { throw new Error('QuotaExceededError') } }))
    const res = store.save(emptySnapshot())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Quota/)
  })

  it('load() reports blocked storage instead of pretending there is simply no draft', () => {
    const store = createLocalGuestStorage(() => fakeStorage({ getItem: () => { throw new Error('SecurityError') } }))
    const res = store.load()
    expect(res.error).toMatch(/blocking local storage/)
    expect(res.snapshot.nodes).toHaveLength(0)
  })

  it('load() keeps a backup of unreadable data rather than silently overwriting it', () => {
    const backing = fakeStorage()
    backing.setItem(GUEST_KEY, '{not json')
    const store = createLocalGuestStorage(() => backing)
    const res = store.load()
    expect(res.error).toMatch(/could not be read/)
    expect(backing.getItem(GUEST_BACKUP_KEY)).toBe('{not json')
  })

  it('round-trips a snapshot and tolerates missing arrays in old data', () => {
    const backing = fakeStorage()
    const store = createLocalGuestStorage(() => backing)
    backing.setItem(GUEST_KEY, JSON.stringify({ displayName: 'Old', nodes: [] }))
    const res = store.load()
    expect(res.error).toBeNull()
    expect(res.snapshot.displayName).toBe('Old')
    expect(res.snapshot.edges).toEqual([])
    expect(res.snapshot.reflections).toEqual([])
  })

  it('clear() returns the error when removal fails', () => {
    const store = createLocalGuestStorage(() => fakeStorage({ removeItem: () => { throw new Error('nope') } }))
    expect(store.clear().ok).toBe(false)
  })
})
