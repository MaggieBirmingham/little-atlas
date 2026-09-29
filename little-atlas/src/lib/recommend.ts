import type { BrainstormEntry, CatalogCategory, CatalogItem, SuggestionState } from './types'

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

export interface Recommendation {
  item: CatalogItem
  score: number
  /** Human-readable, explainable reasons — never a black box. */
  reasons: string[]
}

/**
 * Deterministic keyword matcher: every brainstorm line is tokenized and
 * matched against each catalog item's keywords/label/subcategory words.
 * No ML/AI call, no randomness — the same brainstorm text always produces
 * the same ranked suggestions, and every suggestion says exactly why it
 * was surfaced so the person can trust (or dismiss) it.
 */
export function recommendFromBrainstorm(
  entries: BrainstormEntry[] | string[],
  catalog: CatalogItem[],
  opts: { excludeCatalogIds?: Set<string>; limit?: number } = {}
): Recommendation[] {
  const limit = opts.limit ?? 8
  const exclude = opts.excludeCatalogIds ?? new Set<string>()

  const lines = entries.map((e) => (typeof e === 'string' ? e : e.text))
  const tokenSet = new Set(lines.flatMap(tokenize))
  if (tokenSet.size === 0) return []

  const scored: Recommendation[] = []
  for (const item of catalog) {
    if (exclude.has(item.id)) continue
    const matchedKeywords = item.keywords.filter((kw) =>
      tokenize(kw).every((t) => tokenSet.has(t)) || tokenSet.has(kw.toLowerCase())
    )
    const labelWords = tokenize(item.label)
    const matchedLabelWords = labelWords.filter((w) => tokenSet.has(w))
    const subcatWords = tokenize(item.subcategory)
    const matchedSubcatWords = subcatWords.filter((w) => tokenSet.has(w))

    const score = matchedKeywords.length * 2 + matchedLabelWords.length + matchedSubcatWords.length * 0.5
    if (score <= 0) continue

    const reasons: string[] = []
    if (matchedKeywords.length > 0) {
      reasons.push(`You mentioned “${matchedKeywords[0]}”`)
    }
    if (matchedLabelWords.length > 0 && matchedKeywords.length === 0) {
      reasons.push(`Related to “${matchedLabelWords[0]}” from your brainstorm`)
    }
    if (reasons.length === 0) reasons.push(`Related to ${item.subcategory.toLowerCase()}`)

    scored.push({ item, score, reasons })
  }

  scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  return scored.slice(0, limit)
}

/** Suggested branches to show when a person taps/expands a category node:
 * every catalog item in that category they haven't already added and
 * haven't marked "not for me". Sorted alphabetically for predictability. */
export function suggestedBranchesForCategory(
  category: CatalogCategory,
  catalog: CatalogItem[],
  excludeCatalogIds: Set<string>,
  suggestionStates: SuggestionState[]
): CatalogItem[] {
  const notForMe = new Set(
    suggestionStates.filter((s) => s.state === 'not_for_me').map((s) => s.catalog_id)
  )
  return catalog
    .filter((c) => c.category === category && !excludeCatalogIds.has(c.id) && !notForMe.has(c.id))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Related interests shown in the detail drawer: catalog items this item
 * points to, resolved back to full CatalogItem records. */
export function relatedCatalogItems(item: CatalogItem, catalog: CatalogItem[]): CatalogItem[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return item.related.map((id) => byId.get(id)).filter((c): c is CatalogItem => Boolean(c))
}

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  movement: 'Movement',
  mind_logic: 'Mind & Logic',
  creativity: 'Creativity',
  people: 'People',
  nature: 'Nature',
  technology_making: 'Technology & Making',
  wellbeing: 'Wellbeing'
}

export const CATEGORY_ORDER: CatalogCategory[] = [
  'movement',
  'mind_logic',
  'creativity',
  'people',
  'nature',
  'technology_making',
  'wellbeing'
]

/** Short, neutral descriptions shown when a category is opened. */
export const CATEGORY_DESCRIPTIONS: Record<CatalogCategory, string> = {
  movement: 'Ways of getting your body moving, from an easy stroll to dancing in the kitchen. Nothing here needs a gym or a goal.',
  mind_logic: 'Puzzles, strategy, languages and other ways to give your thinking something satisfying to chew on.',
  creativity: 'Making things for the fun of it: drawing, writing, music. The process matters more than the result.',
  people: 'Ways to spend time with others around a shared activity, at a pace that suits you.',
  nature: 'Time outdoors and things that grow: birds, plants, trails, and noticing the world around you.',
  technology_making: 'Building, tinkering and coding, from small visual projects to hands-on hardware.',
  wellbeing: 'Small, gentle practices around rest, breathing and the body. General ideas only, not medical advice.'
}
