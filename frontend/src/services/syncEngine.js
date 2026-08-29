/**
 * Sync Engine for ReBill Hybrid POS Architecture
 * 
 * Manages automatic background synchronization of:
 * - Offline Outbox actions (bills, orders, new customers)
 * - Master Data cache freshness (menu items, tables, settings)
 * - Real-time network & connectivity heartbeats
 */

import api from './api'
import {
  getPendingOutbox,
  markOutboxSynced,
  removeOutboxItem,
  setCache,
  getCache,
  getPendingCount,
} from './db'

class SyncEngine {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.isSyncing = false
    this.lastSyncedAt = null
    this.pendingCount = 0
    this.listeners = new Set()
    this.heartbeatTimer = null

    this._init()
  }

  _init() {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.isOnline = true
      this._notify()
      this.triggerSync()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this._notify()
    })

    // Start background connectivity heartbeat & auto-sync loop (every 15 seconds)
    this.heartbeatTimer = setInterval(() => {
      this.checkConnectivityAndSync()
    }, 15000)

    // Initial check
    setTimeout(() => {
      this.checkConnectivityAndSync()
    }, 1000)
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  _notify() {
    const state = this.getState()
    this.listeners.forEach((listener) => {
      try {
        listener(state)
      } catch (err) {
        console.error('Error in sync listener:', err)
      }
    })
  }

  getState() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount: this.pendingCount,
    }
  }

  async checkConnectivity() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false
      this._notify()
      return false
    }

    try {
      const response = await api.get('/billing/sync/ping/', { timeout: 4000 })
      const online = response.status === 200
      if (this.isOnline !== online) {
        this.isOnline = online
        this._notify()
      }
      return online
    } catch {
      if (this.isOnline !== false) {
        this.isOnline = false
        this._notify()
      }
      return false
    }
  }

  async checkConnectivityAndSync() {
    this.pendingCount = await getPendingCount()
    this._notify()

    const online = await this.checkConnectivity()
    if (online && this.pendingCount > 0 && !this.isSyncing) {
      await this.triggerSync()
    }
  }

  /**
   * Main sync trigger: batches all pending outbox actions and uploads to cloud backend.
   */
  async triggerSync() {
    if (this.isSyncing) return { success: false, reason: 'Already syncing' }

    const pending = await getPendingOutbox()
    this.pendingCount = pending.length
    if (pending.length === 0) {
      this._notify()
      return { success: true, count: 0 }
    }

    this.isSyncing = true
    this._notify()

    try {
      const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
      const payload = {
        batch_id: batchId,
        client_synced_at: new Date().toISOString(),
        actions: pending.map((item) => ({
          tx_id: item.tx_id,
          action_type: item.action_type,
          payload: item.payload,
        })),
      }

      const response = await api.post('/billing/sync/batch/', payload)
      const data = response.data

      if (data && data.results) {
        for (const res of data.results) {
          if (res.status === 'synced' || res.status === 'skipped') {
            await markOutboxSynced(res.tx_id, res)
            await removeOutboxItem(res.tx_id)
          }
        }
      }

      this.lastSyncedAt = new Date().toISOString()
      this.pendingCount = await getPendingCount()
      this.isOnline = true
      this._notify()

      // Refresh master caches in the background after sync
      this.refreshMasterDataCache().catch(() => {})

      return { success: true, count: pending.length, data }
    } catch (err) {
      console.warn('Sync attempt failed:', err)
      this.isOnline = false
      this.pendingCount = await getPendingCount()
      this._notify()
      return { success: false, error: err }
    } finally {
      this.isSyncing = false
      this._notify()
    }
  }

  /**
   * Downloads and caches latest Menu, Tables, Settings, and Customers in IndexedDB.
   */
  async refreshMasterDataCache() {
    try {
      const [itemsRes, catRes, settingsRes, tablesRes] = await Promise.allSettled([
        api.get('/menu/items/'),
        api.get('/menu/categories/'),
        api.get('/settings/restaurant/'),
        api.get('/tables/tables/'),
      ])

      if (itemsRes.status === 'fulfilled') {
        const items = itemsRes.value.data?.results || itemsRes.value.data || []
        await setCache('menu_items', items)
      }
      if (catRes.status === 'fulfilled') {
        const cats = catRes.value.data?.results || catRes.value.data || []
        await setCache('menu_categories', cats)
      }
      if (settingsRes.status === 'fulfilled') {
        await setCache('restaurant_settings', settingsRes.value.data)
      }
      if (tablesRes.status === 'fulfilled') {
        const tbls = tablesRes.value.data?.results || tablesRes.value.data || []
        await setCache('restaurant_tables', tbls)
      }
    } catch (err) {
      console.warn('Could not refresh master data cache:', err)
    }
  }
}

export const syncEngine = new SyncEngine()
export default syncEngine
