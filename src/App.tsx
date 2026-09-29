import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useMapData } from './hooks/useMapData'
import { BrainstormCapture } from './components/onboarding/BrainstormCapture'
import { SuggestedForYou } from './components/onboarding/SuggestedForYou'
import { MapView } from './components/map/MapView'
import { ListView } from './components/map/ListView'
import { DetailDrawer } from './components/map/DetailDrawer'
import { CategoryPanel } from './components/map/CategoryPanel'
import { ReflectionPanel } from './components/reflection/ReflectionPanel'
import { ExportDeleteAccount } from './components/settings/ExportDeleteAccount'
import { AuthGate } from './components/auth/AuthGate'
import { Banner } from './components/common/Banner'
import { recommendFromBrainstorm } from './lib/recommend'
import type { GhostNode } from './lib/ghosts'
import type { Selection } from './lib/selection'

type Tab = 'map' | 'list' | 'reflect' | 'settings'

/** Supabase returns the session (or an error) in the URL fragment after a
 * magic-link click; the Supabase client parses it itself. See hooks/useAuth.ts. */
function readAuthCallback(): { inProgress: boolean; error: string | null } {
  const hash = window.location.hash
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const error = params.get('error_description')
  return { inProgress: hash.includes('access_token') || Boolean(error), error }
}

export default function App() {
  const auth = useAuth()
  const { session, loading: authLoading } = auth
  const mapData = useMapData(session)
  const { snapshot, catalog } = mapData

  const [tab, setTab] = useState<Tab>('map')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Selection | null>(null)
  const [history, setHistory] = useState<Selection[]>([])
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [showSuggestedStrip, setShowSuggestedStrip] = useState(true)
  const [nameDraft, setNameDraft] = useState('')
  const [callback] = useState(readAuthCallback)
  const [callbackInProgress, setCallbackInProgress] = useState(callback.inProgress)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)

  useEffect(() => {
    if (!callbackInProgress || authLoading) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setCallbackInProgress(false)
  }, [authLoading, callbackInProgress])

  useEffect(() => setNameDraft(snapshot.displayName), [snapshot.displayName])

  const closePanel = useCallback(() => {
    setSelection(null)
    setHistory([])
  }, [])

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, closePanel])

  const centerNode = snapshot.nodes.find((n) => n.kind === 'center')

  const recommendations = useMemo(
    () =>
      recommendFromBrainstorm(snapshot.brainstorm, catalog, {
        excludeCatalogIds: new Set(snapshot.nodes.map((n) => n.catalog_id).filter((x): x is string => Boolean(x))),
        limit: 6
      }),
    [snapshot.brainstorm, snapshot.nodes, catalog]
  )

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const ensureExpanded = (id: string) => setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))

  /** Open something fresh (from the map/list): the back stack starts over. */
  function openFresh(next: Selection) {
    setHistory([])
    setSelection(next)
  }
  /** Open something from inside the panel: remember where we came from. */
  function openFromPanel(next: Selection) {
    if (selection) setHistory((h) => [...h, selection])
    setSelection(next)
  }
  function goBack() {
    const previous = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setSelection(previous ?? null)
  }

  function handleActivate(nodeId: string, ghost?: GhostNode) {
    if (ghost?.level === 'subcategory') return toggleExpanded(nodeId) // a suggested grouping: just reveal what's in it
    const node = snapshot.nodes.find((n) => n.id === nodeId)
    if (node && (node.kind === 'category' || node.kind === 'subcategory')) {
      if (selection?.nodeId === nodeId) {
        // Tapping the open one again folds it away.
        setExpanded((prev) => {
          const next = new Set(prev)
          next.delete(nodeId)
          return next
        })
        return closePanel()
      }
      ensureExpanded(nodeId)
      return openFresh({ nodeId })
    }
    openFresh({ nodeId, ghost })
  }

  function openCatalog(catalogId: string) {
    const existing = snapshot.nodes.find((n) => n.catalog_id === catalogId)
    openFromPanel(existing ? { nodeId: existing.id } : { catalogId })
  }

  async function handleStartMap() {
    await mapData.startMap(snapshot.displayName || 'My Atlas')
  }

  async function handleAddCustom() {
    if (!centerNode) return
    const res = await mapData.addNode({ kind: 'custom', label: customLabel, parentId: centerNode.id })
    if (res.ok) {
      setCustomLabel('')
      setAddingCustom(false)
    }
  }

  function handleSignOut() {
    return auth.signOut()
  }

  if (authLoading && callbackInProgress) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><p>Signing you in…</p></div>
  }

  if (mapData.loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><p>Loading your atlas…</p></div>
  }

  if (mapData.loadError) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '60px auto', padding: 28 }}>
        <h1 style={{ fontSize: '1.4rem' }}>We couldn&apos;t load your map</h1>
        <p role="alert">{mapData.loadError}</p>
        <p style={{ color: 'var(--color-ink-soft)' }}>
          Nothing has been changed or deleted. Your map is still stored; this page just couldn&apos;t reach it.
        </p>
        <button className="btn btn-primary" onClick={mapData.reload}>Try again</button>
      </div>
    )
  }

  const banners = (
    <>
      {callback.error && <Banner kind="error">Sign-in didn&apos;t complete: {callback.error}</Banner>}
      {auth.authError && <Banner kind="error" onDismiss={auth.clearAuthError}>{auth.authError}</Banner>}
      {mapData.error && <Banner kind="error" onDismiss={mapData.dismissError}>{mapData.error}</Banner>}
      {mapData.storageError && <Banner kind="error">{mapData.storageError}</Banner>}
      {mapData.saving && <Banner kind="saving">Saving…</Banner>}
    </>
  )

  if (!centerNode) {
    return (
      <div className="app-shell" style={{ overflowY: 'auto' }}>
        {banners}
        <BrainstormCapture entries={snapshot.brainstorm} onAddEntry={mapData.addBrainstorm} onFinish={handleStartMap} onSkip={handleStartMap} />
      </div>
    )
  }

  const selectedNode = selection?.nodeId ? snapshot.nodes.find((n) => n.id === selection.nodeId) : undefined
  const selectedIsContainer = selectedNode && (selectedNode.kind === 'category' || selectedNode.kind === 'subcategory')

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span aria-hidden="true">🗺️</span>
          <label htmlFor="display-name-input" className="sr-only">Your atlas&apos;s name (shown at the centre of your map)</label>
          <input
            id="display-name-input"
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={async () => {
              if (!nameDraft.trim() || nameDraft.trim() === snapshot.displayName) return
              const res = await mapData.renameCenter(nameDraft)
              if (!res.ok) setNameDraft(snapshot.displayName)
            }}
            style={{ border: 'none', background: 'transparent', fontFamily: 'var(--font-hand)', fontWeight: 700, fontSize: '1.1rem', width: 160 }}
          />
        </div>
        <nav className="tabs" aria-label="Sections">
          {(['map', 'list', 'reflect', 'settings'] as Tab[]).map((t) => (
            <button key={t} className="tab-btn" aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
              {t === 'map' ? 'Map' : t === 'list' ? 'List' : t === 'reflect' ? 'Reflect' : 'Settings'}
            </button>
          ))}
        </nav>
      </header>

      {banners}
      {mapData.isGuest && !guestBannerDismissed && (
        <Banner kind="info" onDismiss={() => setGuestBannerDismissed(true)}>
          You&apos;re exploring as a guest, so your map is saved in this browser only.{' '}
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setTab('settings')}>Sign in to keep it in an account</button>
        </Banner>
      )}
      {!mapData.isGuest && mapData.hasPendingGuestDraft && (
        <Banner kind="info">
          You have a guest draft from before you signed in.{' '}
          <button className="btn btn-secondary" style={{ padding: '4px 12px', marginRight: 6 }} onClick={() => void mapData.importGuestDraft()}>Add it to my account</button>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => mapData.discardGuestDraft()}>Discard it</button>
        </Banner>
      )}

      <div className="app-main">
        <main className="main-content">
          {tab === 'map' && (
            <>
              {showSuggestedStrip && (
                <SuggestedForYou recommendations={recommendations} mapData={mapData} onDismiss={() => setShowSuggestedStrip(false)} />
              )}
              <div style={{ padding: '0 12px' }}>
                {!addingCustom ? (
                  <button className="btn" onClick={() => setAddingCustom(true)}>+ Add an uncategorized curiosity</button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleAddCustom()
                    }}
                    style={{ display: 'flex', gap: 6, maxWidth: 420 }}
                  >
                    <label htmlFor="custom-curiosity" className="sr-only">An uncategorized curiosity</label>
                    <input id="custom-curiosity" autoFocus type="text" placeholder="Anything, no category needed" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                    <button type="submit" className="btn btn-primary">Add</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAddingCustom(false)}>Cancel</button>
                  </form>
                )}
              </div>
              <MapView snapshot={snapshot} catalog={catalog} expanded={expanded} selectedNodeId={selection?.nodeId ?? null} onActivate={handleActivate} />
            </>
          )}

          {tab === 'list' && (
            <ListView snapshot={snapshot} catalog={catalog} expanded={expanded} onToggle={toggleExpanded} onOpen={(nodeId, ghost) => openFresh({ nodeId, ghost })} />
          )}

          {tab === 'reflect' && <ReflectionPanel snapshot={snapshot} catalog={catalog} mapData={mapData} />}

          {tab === 'settings' && (
            <div>
              {!session && <AuthGate sendMagicLink={auth.sendMagicLink} onContinueAsGuest={() => setTab('map')} />}
              <ExportDeleteAccount session={session} displayName={snapshot.displayName} exportJson={mapData.exportJson} onSignOut={handleSignOut} />
            </div>
          )}
        </main>

        {selection && (
          <aside className="side-panel" aria-label="Details">
            {selectedNode && selectedIsContainer ? (
              <CategoryPanel
                node={selectedNode}
                snapshot={snapshot}
                catalog={catalog}
                mapData={mapData}
                onClose={closePanel}
                onOpenNode={(nodeId) => openFromPanel({ nodeId })}
                onOpenCatalog={openCatalog}
              />
            ) : (
              <DetailDrawer
                selection={selection}
                snapshot={snapshot}
                catalog={catalog}
                mapData={mapData}
                onClose={closePanel}
                onBack={history.length > 0 ? goBack : undefined}
                onOpenCatalog={openCatalog}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
