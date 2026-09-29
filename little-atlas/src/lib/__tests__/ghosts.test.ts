import { describe, expect, it } from 'vitest'
import { buildGhostNodes } from '../ghosts'
import { makeNode, resetNodeFactoryCounter } from '../../test/factories'
import type { CatalogItem } from '../types'

const CATALOG: CatalogItem[] = [
  {
    id: 'movement-walking',
    category: 'movement',
    subcategory: 'Low-key cardio',
    label: 'Everyday walking',
    description: '',
    possible_benefits: [],
    beginner_steps: [],
    time_cost_access: '',
    links: [],
    related: [],
    keywords: [],
    source_label: 'Test',
    reviewed_on: '2026-01-01'
  },
  {
    id: 'movement-dance',
    category: 'movement',
    subcategory: 'Dance',
    label: 'Dance basics',
    description: '',
    possible_benefits: [],
    beginner_steps: [],
    time_cost_access: '',
    links: [],
    related: [],
    keywords: [],
    source_label: 'Test',
    reviewed_on: '2026-01-01'
  }
]

describe('buildGhostNodes', () => {
  it('produces no ghosts when nothing is expanded', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const { fauxNodes } = buildGhostNodes([center, category], CATALOG, new Set(), new Set(), new Set())
    expect(fauxNodes).toHaveLength(0)
  })

  it('expanding a category reveals its distinct suggested subcategories, not yet hobbies', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const { fauxNodes } = buildGhostNodes([center, category], CATALOG, new Set([category.id]), new Set(), new Set())
    expect(fauxNodes.map((n) => n.label).sort()).toEqual(['Dance', 'Low-key cardio'])
    expect(fauxNodes.every((n) => n.kind === 'subcategory')).toBe(true)
  })

  it('expanding a suggested subcategory too reveals its hobby ghosts', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const expanded = new Set([category.id, `ghostsub:${category.id}:Low-key cardio`])
    const { fauxNodes } = buildGhostNodes([center, category], CATALOG, expanded, new Set(), new Set())
    const hobbyGhosts = fauxNodes.filter((n) => n.kind === 'hobby')
    expect(hobbyGhosts.map((n) => n.label)).toEqual(['Everyday walking'])
  })

  it('does not suggest a subcategory the user already added for real, but does still offer its remaining hobbies when that real node is expanded', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const realSub = makeNode({ kind: 'subcategory', label: 'Low-key cardio', parent_id: category.id })
    const expanded = new Set([category.id, realSub.id])
    const { fauxNodes } = buildGhostNodes([center, category, realSub], CATALOG, expanded, new Set(), new Set())

    const ghostSubcats = fauxNodes.filter((n) => n.kind === 'subcategory')
    expect(ghostSubcats.map((n) => n.label)).toEqual(['Dance'])
    const hobbyGhosts = fauxNodes.filter((n) => n.kind === 'hobby')
    expect(hobbyGhosts).toHaveLength(1)
    expect(hobbyGhosts[0].parent_id).toBe(realSub.id)
  })

  it('excludes a hobby already added anywhere on the map', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const expanded = new Set([category.id, `ghostsub:${category.id}:Low-key cardio`])
    const { fauxNodes } = buildGhostNodes(
      [center, category],
      CATALOG,
      expanded,
      new Set(['movement-walking']),
      new Set()
    )
    expect(fauxNodes.filter((n) => n.kind === 'hobby')).toHaveLength(0)
  })

  it('excludes a hobby marked not-for-me', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'Movement', parent_id: center.id })
    const expanded = new Set([category.id, `ghostsub:${category.id}:Dance`])
    const { fauxNodes } = buildGhostNodes([center, category], CATALOG, expanded, new Set(), new Set(['movement-dance']))
    expect(fauxNodes.filter((n) => n.kind === 'hobby')).toHaveLength(0)
  })

  it('offers no suggestions for a renamed/custom category that no longer matches a seeded catalog category', () => {
    resetNodeFactoryCounter()
    const center = makeNode({ kind: 'center', label: 'Me' })
    const category = makeNode({ kind: 'category', label: 'My Own Thing', parent_id: center.id })
    const { fauxNodes } = buildGhostNodes([center, category], CATALOG, new Set([category.id]), new Set(), new Set())
    expect(fauxNodes).toHaveLength(0)
  })
})
