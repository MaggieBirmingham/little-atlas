// Core domain types shared by the app, guest store, and Supabase layer.

export type NodeKind = 'center' | 'category' | 'subcategory' | 'hobby' | 'custom'

/** Where a node came from: something the person typed/added themselves,
 * or a suggestion surfaced from the curated catalog that they have not
 * yet acted on (still visible, but visually distinct, never auto-added). */
export type NodeOrigin = 'personal' | 'suggested'

/** Low-pressure status a person can optionally set on a node they've added.
 * Deliberately NOT streaks/points/levels — just where a curiosity sits for them. */
export type NodeStatus = 'curious' | 'trying' | 'active' | 'paused' | 'not_for_me' | null

export interface MapNode {
  id: string
  user_id: string
  kind: NodeKind
  label: string
  parent_id: string | null
  catalog_id: string | null
  origin: NodeOrigin
  status: NodeStatus
  notes: string | null
  angle: number | null // stored layout hint, radians, for stable repositioning
  created_at: string
  updated_at: string
}

/** A non-hierarchical association between two nodes ("this connects to that"),
 * separate from the parent/child tree so we can freely allow cross-links
 * without ever creating a cycle in the tree itself. */
export interface MapEdge {
  id: string
  user_id: string
  from_node: string
  to_node: string
  created_at: string
}

export type SuggestionStateValue = 'saved_for_later' | 'not_for_me'

export interface SuggestionState {
  id: string
  user_id: string
  catalog_id: string
  state: SuggestionStateValue
  created_at: string
}

export interface CatalogLink {
  label: string
  url: string
}

export type CatalogCategory =
  | 'movement'
  | 'mind_logic'
  | 'creativity'
  | 'people'
  | 'nature'
  | 'technology_making'
  | 'wellbeing'

export interface CatalogItem {
  id: string
  category: CatalogCategory
  subcategory: string
  label: string
  description: string
  /** Carefully worded — "may help with", never diagnostic or promissory. */
  possible_benefits: string[]
  beginner_steps: string[]
  time_cost_access: string
  links: CatalogLink[]
  related: string[] // catalog ids
  keywords: string[] // used by the deterministic recommender
  source_label: string
  reviewed_on: string // ISO date, curator review date shown transparently in UI
}

export interface BrainstormEntry {
  id: string
  user_id: string
  text: string
  created_at: string
}

export interface Reflection {
  id: string
  user_id: string
  node_id: string | null
  text: string
  created_at: string
}

export interface Profile {
  id: string
  display_name: string
  created_at: string
  updated_at: string
}

/** The full local snapshot used for guest (pre-login) drafts and for
 * optimistic in-memory state once logged in. */
export interface MapSnapshot {
  displayName: string
  nodes: MapNode[]
  edges: MapEdge[]
  suggestionStates: SuggestionState[]
  brainstorm: BrainstormEntry[]
  reflections: Reflection[]
}

export function emptySnapshot(displayName = 'My Atlas'): MapSnapshot {
  return {
    displayName,
    nodes: [],
    edges: [],
    suggestionStates: [],
    brainstorm: [],
    reflections: []
  }
}
