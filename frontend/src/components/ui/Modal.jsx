import { useEffect } from 'react'

const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

export default function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[90vh] w-full ${WIDTH[size]} flex-col rounded-xl bg-white shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
