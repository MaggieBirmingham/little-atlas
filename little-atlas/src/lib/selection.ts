import type { GhostNode } from './ghosts'

/** What the side panel is showing. Either a node on the map (nodeId), a
 * suggestion currently drawn on the map (ghost), or a catalog entry the person
 * is exploring that isn't on their map (catalogId). */
export interface Selection {
  nodeId?: string
  ghost?: GhostNode
  catalogId?: string
}
