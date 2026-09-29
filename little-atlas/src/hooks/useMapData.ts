import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { guestStorage } from '../lib/guestStore'
import { MapController, type ControllerState } from '../lib/mapController'
import { createSupabaseStore, type DbClient } from '../lib/remoteStore'
import catalogSeed from '../data/catalogSeed.json'
import type { CatalogItem } from '../lib/types'

const CATALOG: CatalogItem[] = catalogSeed as CatalogItem[]

export type MapActions = Pick<
  MapController,
  | 'startMap'
  | 'renameCenter'
  | 'addNode'
  | 'addCatalogItem'
  | 'updateNode'
  | 'moveNode'
  | 'deleteNode'
  | 'addEdge'
  | 'removeEdge'
  | 'setSuggestionState'
  | 'addBrainstorm'
  | 'addReflection'
  | 'importGuestDraft'
  | 'discardGuestDraft'
  | 'exportJson'
  | 'dismissError'
>

export interface UseMapData extends MapActions {
  loading: boolean
  loadError: string | null
  reload: () => void
  saving: boolean
  error: string | null
  storageError: string | null
  isGuest: boolean
  hasPendingGuestDraft: boolean
  snapshot: ControllerState['snapshot']
  catalog: CatalogItem[]
}

export function useMapData(session: Session | null): UseMapData {
  const userId = session?.user.id ?? null
  const signedIn = isSupabaseConfigured && userId !== null

  const controller = useMemo(
    () =>
      new MapController({
        remote: signedIn && userId ? createSupabaseStore(supabase as unknown as DbClient, userId) : null,
        userId: signedIn ? userId : null,
        storage: guestStorage
      }),
    [signedIn, userId]
  )

  useEffect(() => {
    void controller.load()
  }, [controller])

  const state = useSyncExternalStore(controller.subscribe, controller.getState)

  return {
    loading: state.status === 'loading',
    loadError: state.loadError,
    reload: () => void controller.load(),
    saving: state.pendingWrites > 0,
    error: state.error,
    storageError: state.storageError,
    isGuest: controller.isGuest,
    hasPendingGuestDraft: state.hasPendingGuestDraft,
    snapshot: state.snapshot,
    catalog: CATALOG,
    startMap: controller.startMap,
    renameCenter: controller.renameCenter,
    addNode: controller.addNode,
    addCatalogItem: controller.addCatalogItem,
    updateNode: controller.updateNode,
    moveNode: controller.moveNode,
    deleteNode: controller.deleteNode,
    addEdge: controller.addEdge,
    removeEdge: controller.removeEdge,
    setSuggestionState: controller.setSuggestionState,
    addBrainstorm: controller.addBrainstorm,
    addReflection: controller.addReflection,
    importGuestDraft: controller.importGuestDraft,
    discardGuestDraft: controller.discardGuestDraft,
    exportJson: controller.exportJson,
    dismissError: controller.dismissError
  }
}
