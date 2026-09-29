import { describe, expect, it } from 'vitest'
import { recommendFromBrainstorm, relatedCatalogItems, suggestedBranchesForCategory } from '../recommend'
import type { CatalogItem, SuggestionState } from '../types'

const CATALOG: CatalogItem[] = [
  {
    id: 'movement-walking',
    category: 'movement',
    subcategory: 'Low-key cardio',
    label: 'Everyday walking',
    description: 'Walk more.',
    possible_benefits: [],
    beginner_steps: [],
    time_cost_access: 'Free',
    links: [],
    related: ['nature-hiking'],
    keywords: ['walk', 'walking', 'steps'],
    source_label: 'Test',
    reviewed_on: '2026-01-01'
  },
  {
    id: 'nature-hiking',
    category: 'nature',
    subcategory: 'Getting outside',
    label: 'Local trails',
    description: 'Hike nearby.',
    possible_benefits: [],
    beginner_steps: [],
    time_cost_access: 'Free',
    links: [],
    related: [],
    keywords: ['hike', 'trail', 'outdoors'],
    source_label: 'Test',
    reviewed_on: '2026-01-01'
  },
  {
    id: 'mind-logic-chess',
    category: 'mind_logic',
    subcategory: 'Strategy games',
    label: 'Chess fundamentals',
    description: 'Learn chess.',
    possible_benefits: [],
    beginner_steps: [],
    time_cost_access: 'Free',
    links: [],
    related: [],
    keywords: ['chess', 'strategy', 'board game'],
    source_label: 'Test',
    reviewed_on: '2026-01-01'
  }
]

describe('recommendFromBrainstorm', () => {
  it('matches catalog items whose keywords appear in the brainstorm text', () => {
    const recs = recommendFromBrainstorm(['I used to love walking every evening'], CATALOG)
    expect(recs.map((r) => r.item.id)).toContain('movement-walking')
  })

  it('is explainable: every recommendation states why it was surfaced', () => {
    const recs = recommendFromBrainstorm(['always wondered about chess'], CATALOG)
    const chess = recs.find((r) => r.item.id === 'mind-logic-chess')
    expect(chess).toBeDefined()
    expect(chess!.reasons.length).toBeGreaterThan(0)
    expect(chess!.reasons[0]).toMatch(/chess/i)
  })

  it('is deterministic: identical input always produces identical, identically-ordered output', () => {
    const text = ['maybe hiking, maybe chess, who knows']
    const first = recommendFromBrainstorm(text, CATALOG)
    const second = recommendFromBrainstorm(text, CATALOG)
    expect(first.map((r) => r.item.id)).toEqual(second.map((r) => r.item.id))
  })

  it('returns nothing for brainstorm text unrelated to any catalog keywords', () => {
    const recs = recommendFromBrainstorm(['xyzzy plugh quux'], CATALOG)
    expect(recs).toHaveLength(0)
  })

  it('excludes catalog ids the caller says are already on the map', () => {
    const recs = recommendFromBrainstorm(['I love walking'], CATALOG, { excludeCatalogIds: new Set(['movement-walking']) })
    expect(recs.find((r) => r.item.id === 'movement-walking')).toBeUndefined()
  })

  it('respects the limit', () => {
    const recs = recommendFromBrainstorm(['walking hiking chess'], CATALOG, { limit: 1 })
    expect(recs).toHaveLength(1)
  })
})

describe('suggestedBranchesForCategory', () => {
  it('excludes items already added to the map', () => {
    const result = suggestedBranchesForCategory('movement', CATALOG, new Set(['movement-walking']), [])
    expect(result.find((i) => i.id === 'movement-walking')).toBeUndefined()
  })

  it('excludes items the user marked not for me', () => {
    const states: SuggestionState[] = [{ id: 's1', user_id: 'u', catalog_id: 'movement-walking', state: 'not_for_me', created_at: 'now' }]
    const result = suggestedBranchesForCategory('movement', CATALOG, new Set(), states)
    expect(result.find((i) => i.id === 'movement-walking')).toBeUndefined()
  })

  it('still includes items merely saved for later', () => {
    const states: SuggestionState[] = [{ id: 's1', user_id: 'u', catalog_id: 'movement-walking', state: 'saved_for_later', created_at: 'now' }]
    const result = suggestedBranchesForCategory('movement', CATALOG, new Set(), states)
    expect(result.find((i) => i.id === 'movement-walking')).toBeDefined()
  })
})

describe('relatedCatalogItems', () => {
  it('resolves related catalog ids to full items', () => {
    const walking = CATALOG.find((c) => c.id === 'movement-walking')!
    const related = relatedCatalogItems(walking, CATALOG)
    expect(related.map((r) => r.id)).toEqual(['nature-hiking'])
  })

  it('silently drops related ids that no longer exist in the catalog', () => {
    const fake: CatalogItem = { ...CATALOG[0], related: ['does-not-exist'] }
    expect(relatedCatalogItems(fake, CATALOG)).toEqual([])
  })
})
