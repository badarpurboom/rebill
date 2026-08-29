/**
 * IndexedDB Offline Database Layer for ReBill POS Hybrid Engine
 * 
 * Provides zero-latency local caching for:
 * 1. Master Data (Menu, Categories, Tables, Settings, Customers)
 * 2. Outbox Queue for pending sync items (Bills, Customers, Orders)
 * 3. Offline Running Orders & Offline Generated Slips
 */

const DB_NAME = 'rebill_pos_offline_db'
const DB_VERSION = 1

let dbInstance = null

export function initDB() {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // 1. Key-Value Cache (for Master data)
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }

      // 2. Outbox Queue for sync actions
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'tx_id' })
        outboxStore.createIndex('status', 'status', { unique: false })
        outboxStore.createIndex('created_at', 'created_at', { unique: false })
      }

      // 3. Offline Running Orders
      if (!db.objectStoreNames.contains('running_orders')) {
        const ordersStore = db.createObjectStore('running_orders', { keyPath: 'id' })
        ordersStore.createIndex('table_id', 'table_id', { unique: false })
      }

      // 4. Offline Bills History Cache
      if (!db.objectStoreNames.contains('offline_bills')) {
        const billsStore = db.createObjectStore('offline_bills', { keyPath: 'bill_number' })
        billsStore.createIndex('created_at', 'created_at', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      resolve(dbInstance)
    }

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error)
      reject(event.target.error)
    }
  })
}

// ── Cache Operations ────────────────────────────────────────────────────────

export async function setCache(key, value) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      store.put({ key, value, updated_at: new Date().toISOString() })
      tx.oncomplete = () => resolve(true)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn(`Failed to setCache for ${key}:`, err)
    return false
  }
}

export async function getCache(key) {
  try {
    const db = await initDB()
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.value ?? null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// ── Outbox Sync Queue Operations ────────────────────────────────────────────

export async function enqueueOutbox(action_type, payload) {
  try {
    const db = await initDB()
    const tx_id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)

    const entry = {
      tx_id,
      action_type,
      payload,
      status: 'PENDING',
      attempts: 0,
      created_at: new Date().toISOString(),
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      store.put(entry)
      tx.oncomplete = () => resolve(entry)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.error('Failed to enqueue outbox:', err)
    throw err
  }
}

export async function getPendingOutbox() {
  try {
    const db = await initDB()
    return new Promise((resolve) => {
      const tx = db.transaction('outbox', 'readonly')
      const store = tx.objectStore('outbox')
      const request = store.getAll()
      request.onsuccess = () => {
        const items = request.result || []
        const pending = items.filter((item) => item.status === 'PENDING')
        // Sort chronologically
        pending.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        resolve(pending)
      }
      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function getPendingCount() {
  try {
    const items = await getPendingOutbox()
    return items.length
  } catch {
    return 0
  }
}

export async function markOutboxSynced(tx_id, serverResponse = null) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      const getReq = store.get(tx_id)
      getReq.onsuccess = () => {
        const item = getReq.result
        if (item) {
          item.status = 'SYNCED'
          item.synced_at = new Date().toISOString()
          item.server_response = serverResponse
          store.put(item)
        }
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn(`Failed to markOutboxSynced for ${tx_id}:`, err)
  }
}

export async function removeOutboxItem(tx_id) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      store.delete(tx_id)
      tx.oncomplete = () => resolve(true)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn(`Failed to delete outbox item ${tx_id}:`, err)
  }
}

// ── Offline Running Orders & Bills ──────────────────────────────────────────

export async function saveOfflineRunningOrder(order) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('running_orders', 'readwrite')
      const store = tx.objectStore('running_orders')
      store.put(order)
      tx.oncomplete = () => resolve(order)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.error('Failed to save offline running order:', err)
  }
}

export async function getOfflineRunningOrder(orderIdOrTableId) {
  try {
    const db = await initDB()
    return new Promise((resolve) => {
      const tx = db.transaction('running_orders', 'readonly')
      const store = tx.objectStore('running_orders')
      const request = store.getAll()
      request.onsuccess = () => {
        const list = request.result || []
        const found = list.find(
          (o) => String(o.id) === String(orderIdOrTableId) || String(o.table_id) === String(orderIdOrTableId)
        )
        resolve(found || null)
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function getAllOfflineRunningOrders() {
  try {
    const db = await initDB()
    return new Promise((resolve) => {
      const tx = db.transaction('running_orders', 'readonly')
      const store = tx.objectStore('running_orders')
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function deleteOfflineRunningOrder(orderId) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('running_orders', 'readwrite')
      const store = tx.objectStore('running_orders')
      store.delete(orderId)
      tx.oncomplete = () => resolve(true)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn(`Failed to delete offline running order ${orderId}:`, err)
  }
}

export async function saveOfflineBill(bill) {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_bills', 'readwrite')
      const store = tx.objectStore('offline_bills')
      store.put(bill)
      tx.oncomplete = () => resolve(bill)
      tx.onerror = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.error('Failed to save offline bill:', err)
  }
}

// ── Sequence Numbers for Offline KOTs & Bills ───────────────────────────────

export async function getNextOfflineBillNumber(prefix = 'OFF') {
  const key = 'seq_offline_bill_no'
  const current = (await getCache(key)) || 1000
  const next = current + 1
  await setCache(key, next)
  return `${prefix}-${next}`
}

export async function getNextOfflineKOTNumber() {
  const key = 'seq_offline_kot_no'
  const current = (await getCache(key)) || 500
  const next = current + 1
  await setCache(key, next)
  return next
}
