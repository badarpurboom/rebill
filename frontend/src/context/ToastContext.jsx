import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

const TONE = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-brand-200 bg-brand-50 text-brand-900',
}

const ICON = { success: '✅', error: '⚠️', info: 'ℹ️' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info', ttl = 4000) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, tone }])
      setTimeout(() => dismiss(id), ttl)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 6000),
      info: (m) => push(m, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${TONE[t.tone]}`}
          >
            <span aria-hidden>{ICON[t.tone]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-50 transition hover:opacity-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
