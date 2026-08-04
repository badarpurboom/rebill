import { useEffect } from 'react'

/* ─── Status config ─────────────────────────────────────────────────── */
const STATUS_CFG = {
  AVAILABLE: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    label: 'Available',
  },
  OCCUPIED: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    label: 'Occupied',
  },
  BILLED: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
    text: 'text-amber-700',
    label: 'Bill Generated',
  },
}

/* ─── TableConfirmModal ─────────────────────────────────────────────── */
/**
 * Sirf AVAILABLE table click par show hota hai.
 * OCCUPIED / BILLED tables ke liye seedha navigate hota hai — wahan order
 * pehle se chal raha hai, confirm ki zarurat nahi.
 */
export default function TableConfirmModal({ table, onConfirm, onCancel }) {
  if (!table) return null

  const cfg = STATUS_CFG[table.status] ?? STATUS_CFG.AVAILABLE
  const num = String(table.number).padStart(2, '0')

  /* Escape key se close */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl animate-fade-in"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            {/* Table Icon */}
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
              <svg className="size-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="7" width="20" height="10" rx="2" />
                <path strokeLinecap="round" d="M6 7V5M18 7V5M6 17v2M18 17v2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Table T-{num}
              </h2>
              <p className="text-xs font-semibold text-slate-400">
                {table.label || `${table.seats} Seats`}
                {table.label ? ` · ${table.seats} Seats` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Table Info */}
        <div className="px-6 py-4 space-y-3">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
            <span className={`size-2 rounded-full ${cfg.dot} animate-pulse`} />
            <span className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">Table No.</p>
              <p className="text-sm font-black text-slate-900">T-{num}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">Capacity</p>
              <p className="text-sm font-black text-slate-900">{table.seats} Seats</p>
            </div>
          </div>

          {/* Confirmation message */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              Kya aap <strong>Table T-{num}</strong> ko open karna chahte hain?
              Confirm karne ke baad yeh table <strong>Occupied</strong> ho jaayegi.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 pb-6 flex gap-2">
          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98]"
          >
            ✕ Cancel
          </button>

          {/* Confirm */}
          <button
            type="button"
            id="table-confirm-btn"
            onClick={() => onConfirm(table)}
            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-rose-600/25 transition-all active:scale-[0.98]"
          >
            ✓ Open Table
          </button>
        </div>
      </div>
    </div>
  )
}
