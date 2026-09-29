import { describe, expect, it } from 'vitest'
import { computeRadialLayout, descendantIds, isDuplicateEdge, isDuplicateSibling, layoutBounds, parentOptionsFor, treeOrder, wouldCreateCycle } from '../graph'
import { makeNode, resetNodeFactoryCounter } from '../../test/factories'
import type { MapEdge } from '../types'

describe('wouldCreateCycle', () => {
  it('returns false when there is no relationship at all', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const nodes = [center, category]
    expect(wouldCreateCycle(nodes, category.id, center.id)).toBe(false)
  })

  it('rejects a node becoming its own parent', () => {
    const node = makeNode({ kind: 'category', label: 'Movement' })
    expect(wouldCreateCycle([node], node.id, node.id)).toBe(true)
  })

  it('rejects re-parenting a node under its own descendant', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const sub = makeNode({ kind: 'subcategory', label: 'Running', parent_id: category.id })
    const hobby = makeNode({ kind: 'hobby', label: '5k plan', parent_id: sub.id })
    const nodes = [center, category, sub, hobby]
    // Trying to make "Movement" a child of "5k plan" (its own great-grandchild) is a cycle.
    expect(wouldCreateCycle(nodes, category.id, hobby.id)).toBe(true)
    // But making "5k plan" a child of "Movement" directly is fine (not a cycle, just re-parenting).
    expect(wouldCreateCycle(nodes, hobby.id, category.id)).toBe(false)
  })

  it('treats a null new parent (making something top-level) as never a cycle', () => {
    const node = makeNode({ kind: 'category', label: 'Movement' })
    expect(wouldCreateCycle([node], node.id, null)).toBe(false)
  })
})

describe('isDuplicateSibling', () => {
  it('is case- and whitespace-insensitive', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const nodes = [center, category]
    expect(isDuplicateSibling(nodes, center.id, '  movement ')).toBe(true)
    expect(isDuplicateSibling(nodes, center.id, 'MOVEMENT')).toBe(true)
    expect(isDuplicateSibling(nodes, center.id, 'Mindfulness')).toBe(false)
  })

  it('only compares within the same parent', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const catA = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const catB = makeNode({ kind: 'category', label: 'Nature', parent_id: center.id })
    const sub = makeNode({ kind: 'subcategory', label: 'Walking', parent_id: catA.id })
    const nodes = [center, catA, catB, sub]
    expect(isDuplicateSibling(nodes, catB.id, 'Walking')).toBe(false)
    expect(isDuplicateSibling(nodes, catA.id, 'Walking')).toBe(true)
  })

  it('excludes the node being renamed from the duplicate check against itself', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const nodes = [center, category]
    expect(isDuplicateSibling(nodes, center.id, 'Movement', category.id)).toBe(false)
  })
})

describe('isDuplicateEdge', () => {
  it('rejects a self-link', () => {
    expect(isDuplicateEdge([], 'a', 'a')).toBe(true)
  })

  it('treats a->b and b->a as the same link', () => {
    const edges: MapEdge[] = [{ id: 'e1', user_id: 'u', from_node: 'a', to_node: 'b', created_at: 'now' }]
    expect(isDuplicateEdge(edges, 'a', 'b')).toBe(true)
    expect(isDuplicateEdge(edges, 'b', 'a')).toBe(true)
    expect(isDuplicateEdge(edges, 'a', 'c')).toBe(false)
  })
})

describe('computeRadialLayout', () => {
  it('places the center at the origin and children on a ring around it', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const catA = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const catB = makeNode({ kind: 'category', label: 'Nature', parent_id: center.id })
    const laid = computeRadialLayout([center, catA, catB])
    const centerLaid = laid.find((l) => l.node.id === center.id)!
    expect(centerLaid.x).toBe(0)
    expect(centerLaid.y).toBe(0)
    const others = laid.filter((l) => l.node.id !== center.id)
    expect(others).toHaveLength(2)
    for (const o of others) {
      const dist = Math.hypot(o.x, o.y)
      expect(dist).toBeCloseTo(130, 0)
    }
  })

  it('is deterministic: identical input always produces identical positions', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const catA = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const nodes = [center, catA]
    const first = computeRadialLayout(nodes)
    const second = computeRadialLayout(nodes)
    expect(first).toEqual(second)
  })

  it('returns an empty layout when there is no center node', () => {
    const category = makeNode({ kind: 'category', label: 'Movement' })
    expect(computeRadialLayout([category])).toEqual([])
  })
})

describe('layoutBounds', () => {
  it('pads around the min/max of the laid-out points', () => {
    const laid = [
      { node: makeNode({ kind: 'center', label: 'Me' }), x: 0, y: 0, depth: 0, angle: 0 },
      { node: makeNode({ kind: 'category', label: 'Movement' }), x: 100, y: -50, depth: 1, angle: 0 }
    ]
    const bounds = layoutBounds(laid, 20)
    expect(bounds.minX).toBe(-20)
    expect(bounds.minY).toBe(-70)
    expect(bounds.maxX).toBe(120)
    expect(bounds.maxY).toBe(20)
  })
})

describe('descendantIds / treeOrder', () => {
  it('descendantIds includes the node and everything below it, nothing else', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const a = makeNode({ kind: 'category', label: 'A', parent_id: center.id })
    const b = makeNode({ kind: 'category', label: 'B', parent_id: center.id })
    const a1 = makeNode({ kind: 'subcategory', label: 'A1', parent_id: a.id })
    const ids = descendantIds([center, a, b, a1], a.id)
    expect([...ids].sort()).toEqual([a.id, a1.id].sort())
  })

  it('treeOrder puts parents before children even when the input is shuffled, and drops orphans', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const a = makeNode({ kind: 'category', label: 'A', parent_id: center.id })
    const a1 = makeNode({ kind: 'subcategory', label: 'A1', parent_id: a.id })
    const orphan = makeNode({ kind: 'hobby', label: 'Orphan', parent_id: 'does-not-exist' })
    const ordered = treeOrder([a1, orphan, a, center], center.id).map((n) => n.label)
    expect(ordered).toEqual(['Me', 'A', 'A1'])
  })
})

describe('parentOptionsFor', () => {
  function tree() {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const movement = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const nature = makeNode({ kind: 'category', label: 'Nature', parent_id: center.id })
    const cardio = makeNode({ kind: 'subcategory', label: 'Cardio', parent_id: movement.id })
    const walking = makeNode({ kind: 'hobby', label: 'Walking', parent_id: cardio.id })
    const outdoors = makeNode({ kind: 'subcategory', label: 'Outdoors', parent_id: nature.id })
    return { nodes: [center, movement, nature, cardio, walking, outdoors], center, movement, nature, cardio, walking, outdoors }
  }

  it('offers other containers for a hobby, but not where it already is', () => {
    const t = tree()
    const names = parentOptionsFor(t.nodes, t.walking).map((o) => o.node.label)
    expect(names).toContain('Outdoors')
    expect(names).toContain('Me')
    expect(names).not.toContain('Cardio')
  })

  it('only offers the centre for a category, and only categories for a subcategory', () => {
    const t = tree()
    expect(parentOptionsFor(t.nodes, t.movement)).toHaveLength(0) // already under the only centre
    expect(parentOptionsFor(t.nodes, t.cardio).map((o) => o.node.label)).toEqual(['Nature'])
  })

  it('never offers a move for the centre', () => {
    const t = tree()
    expect(parentOptionsFor(t.nodes, t.center)).toHaveLength(0)
  })

  it('marks a destination unavailable when it already has a sibling with the same name', () => {
    const t = tree()
    const clash = makeNode({ kind: 'hobby', label: 'walking', parent_id: t.outdoors.id })
    const option = parentOptionsFor([...t.nodes, clash], t.walking).find((o) => o.node.id === t.outdoors.id)
    expect(option?.ok).toBe(false)
    expect(option?.reason).toMatch(/already has/)
  })
})
