import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { syncEngine } from '@/services/syncEngine'
import { useToast } from './ToastContext'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const [syncState, setSyncState] = useState(syncEngine.getState())
  const toast = useToast()

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state)
    })
    return () => unsubscribe()
  }, [])

  const triggerSync = useCallback(async (showToast = true) => {
    if (showToast) {
      toast?.info?.('Sync shuru ho raha hai...')
    }
    const result = await syncEngine.triggerSync()
    if (showToast) {
      if (result.success) {
        if (result.count > 0) {
          toast?.success?.(`${result.count} offline items successfully sync ho gaye!`)
        } else {
          toast?.success?.('Saara data already cloud par updated hai.')
        }
      } else {
        toast?.error?.(result.reason || 'Sync fail ho gaya. Internet check karein.')
      }
    }
    return result
  }, [toast])

  const checkConnectivity = useCallback(async () => {
    return await syncEngine.checkConnectivity()
  }, [])

  return (
    <SyncContext.Provider
      value={{
        ...syncState,
        triggerSync,
        checkConnectivity,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}
