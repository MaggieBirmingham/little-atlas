import type { GuestStorage, MergePlan, StorageResult } from '../lib/guestStore'
import type { RemoteStore } from '../lib/remoteStore'
import type { MapSnapshot } from '../lib/types'
import { emptySnapshot } from '../lib/types'

/** In-memory guest storage whose save/clear/load can be made to fail. */
export class FakeStorage implements GuestStorage {
  snapshot: MapSnapshot
  loadError: string | null = null
  failSave: string | null = null
  failClear: string | null = null
  saves = 0
  constructor(snapshot: MapSnapshot = emptySnapshot()) {
    this.snapshot = snapshot
  }
  load() {
    return { snapshot: this.snapshot, error: this.loadError }
  }
  save(s: MapSnapshot): StorageResult {
    if (this.failSave) return { ok: false, error: this.failSave }
    this.snapshot = s
    this.saves += 1
    return { ok: true }
  }
  clear(): StorageResult {
    if (this.failClear) return { ok: false, error: this.failClear }
    this.snapshot = emptySnapshot()
    return { ok: true }
  }
  hasDraft() {
    return this.snapshot.nodes.length > 0 || this.snapshot.brainstorm.length > 0
  }
}

type Method = keyof RemoteStore

/** A remote that records every call and throws for the methods listed in `failing`. */
export class FakeRemote implements RemoteStore {
  calls: Array<{ method: Method; args: unknown[] }> = []
  failing = new Set<Method>()
  serverSnapshot: MapSnapshot = emptySnapshot()
  importedPlans: MergePlan[] = []
  loadCount = 0
  /** Fail loadAll only from this call number onwards (1-based); 0 = never. */
  failLoadFromCall = 0

  private hit(method: Method, args: unknown[]): void {
    this.calls.push({ method, args })
    if (this.failing.has(method)) throw new Error(`simulated ${method} failure`)
  }
  callsTo(method: Method) {
    return this.calls.filter((c) => c.method === method)
  }
  async loadAll() {
    this.loadCount += 1
    if (this.failing.has('loadAll') || (this.failLoadFromCall > 0 && this.loadCount >= this.failLoadFromCall)) {
      this.calls.push({ method: 'loadAll', args: [] })
      throw new Error('simulated loadAll failure')
    }
    this.calls.push({ method: 'loadAll', args: [] })
    return this.serverSnapshot
  }
  async insertNodes(...args: Parameters<RemoteStore['insertNodes']>) {
    this.hit('insertNodes', args)
    this.serverSnapshot = { ...this.serverSnapshot, nodes: [...this.serverSnapshot.nodes, ...args[0]] }
  }
  async updateNode(...args: Parameters<RemoteStore['updateNode']>) {
    this.hit('updateNode', args)
  }
  async deleteNode(...args: Parameters<RemoteStore['deleteNode']>) {
    this.hit('deleteNode', args)
  }
  async insertEdge(...args: Parameters<RemoteStore['insertEdge']>) {
    this.hit('insertEdge', args)
  }
  async deleteEdge(...args: Parameters<RemoteStore['deleteEdge']>) {
    this.hit('deleteEdge', args)
  }
  async upsertSuggestionState(...args: Parameters<RemoteStore['upsertSuggestionState']>) {
    this.hit('upsertSuggestionState', args)
  }
  async deleteSuggestionState(...args: Parameters<RemoteStore['deleteSuggestionState']>) {
    this.hit('deleteSuggestionState', args)
  }
  async insertBrainstorm(...args: Parameters<RemoteStore['insertBrainstorm']>) {
    this.hit('insertBrainstorm', args)
  }
  async insertReflection(...args: Parameters<RemoteStore['insertReflection']>) {
    this.hit('insertReflection', args)
  }
  async importGuestDraft(...args: Parameters<RemoteStore['importGuestDraft']>) {
    this.hit('importGuestDraft', args)
    this.importedPlans.push(args[0])
    this.serverSnapshot = { ...this.serverSnapshot, nodes: [...this.serverSnapshot.nodes, ...args[0].nodesToInsert] }
  }
}
