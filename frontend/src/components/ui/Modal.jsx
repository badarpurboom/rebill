import { useEffect } from 'react'

const WIDTH = {
  sm: 'max-w-md sm:max-w-lg',
  md: 'max-w-lg sm:max-w-2xl',
  lg: 'max-w-2xl sm:max-w-4xl lg:max-w-5xl',
  xl: 'max-w-3xl sm:max-w-5xl lg:max-w-6xl',
  full: 'max-w-[96vw]',
}

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
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-hidden">
      {/* Sleek Deep Backdrop with Ultra-Smooth Blur & Fade-In Animation */}
      <div
        className="absolute inset-0 bg-slate-950/70 animate-modal-backdrop cursor-pointer"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal Dialog Card: Spacious, Luxury Rounded Edges & Silky-Smooth Pop Animation */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Modal'}
        className={`relative flex max-h-[92vh] w-full ${WIDTH[size] || WIDTH.md} flex-col rounded-3xl bg-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-slate-200/90 ring-1 ring-black/5 overflow-hidden animate-modal-pop z-10`}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 backdrop-blur-md px-6 sm:px-8 py-4 sm:py-5 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-400 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Close Button with ESC Keyboard Shortcut Hint */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-mono font-bold text-slate-400 select-none">
              ESC
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="size-9 rounded-2xl bg-slate-100/90 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer shadow-2xs hover:shadow-xs border border-slate-200/60 hover:border-rose-200"
            >
              <svg className="size-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Body with Spacious Padding and Thin Scrollbar */}
        <div className="scroll-thin flex-1 overflow-y-auto px-6 sm:px-8 py-5 sm:py-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/90 px-6 sm:px-8 py-4 shrink-0 rounded-b-3xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
