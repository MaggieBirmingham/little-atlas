import { genId } from '../lib/guestStore'
import type { MapNode } from '../lib/types'

let counter = 0

/** Builds a fixture MapNode for tests, with created_at incrementing so
 * layout/sibling-order tests are deterministic regardless of wall-clock time. */
export function makeNode(partial: Partial<MapNode> & Pick<MapNode, 'kind' | 'label'>): MapNode {
  counter += 1
  const stamp = new Date(2026, 0, 1, 0, 0, counter).toISOString()
  return {
    id: genId(),
    user_id: 'test-user',
    parent_id: null,
    catalog_id: null,
    origin: 'personal',
    status: null,
    notes: null,
    angle: null,
    created_at: stamp,
    updated_at: stamp,
    ...partial
  }
}

export function resetNodeFactoryCounter(): void {
  counter = 0
}
