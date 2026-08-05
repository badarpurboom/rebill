import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { kots as kotApi } from '@/services/billing'
import { EmptyState, PageLoader } from '@/components/ui/Misc'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import ThermalKOT from '@/components/print/ThermalKOT'

const POLL_MS = 10000

export default function KOTScreen() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [printing, setPrinting] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const seenIds = useRef(null)

  const load = useCallback(
    async ({ announce = false } = {}) => {
      try {
        const data = await kotApi.list()
        if (announce && seenIds.current) {
          const fresh = data.filter((k) => !seenIds.current.has(k.id))
          if (fresh.length) {
            toast.info(`🔔 New KOT — Table ${fresh[0].table_number}`)
          }
        }
        seenIds.current = new Set(data.map((k) => k.id))
        setRows(data)
        setLastRefresh(new Date())
      } catch (error) {
        if (rows === null) toast.error(errorMessage(error, 'Failed to load KOT list.'))
      }
    },
    [toast, rows],
  )

  useEffect(() => {
    load()
    const id = setInterval(() => load({ announce: true }), POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (rows === null) return <PageLoader label="Loading kitchen tickets…" />

  const urgent = rows.filter((k) => Math.floor((Date.now() - new Date(k.created_at)) / 60000) >= 15).length
  const pending = rows.length

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kitchen Display</h1>
              <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-black text-slate-700">
                KOT Screen
              </span>
              {urgent > 0 && (
                <span className="rounded-full bg-rose-50 border border-rose-300 px-2.5 py-0.5 text-xs font-black text-rose-600 animate-pulse">
                  ⚠ {urgent} Urgent
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {pending} active tickets · Auto-refreshes every {POLL_MS / 1000}s ·
              Last updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          <button
            onClick={() => load()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
        </div>

        {/* Stats strip */}
        {rows.length > 0 && (
          <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span><strong className="text-slate-900">{rows.length - urgent}</strong> On Time</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-rose-500" />
              <span><strong className="text-slate-900">{urgent}</strong> Overdue (&gt;15m)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-slate-400" />
              <span><strong className="text-slate-900">{rows.reduce((n, k) => n + k.items.reduce((s, l) => s + l.quantity, 0), 0)}</strong> Total Items</span>
            </div>
          </div>
        )}
      </div>

      {/* ── KOT Grid ── */}
      {rows.length === 0 ? (
        <EmptyState
          icon="👨‍🍳"
          title="No active KOT tickets"
          hint="Kitchen tickets will appear here automatically when items are sent from the POS terminal."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((kot) => (
            <KOTCard key={kot.id} kot={kot} onPrint={() => setPrinting(kot)} />
          ))}
        </div>
      )}

      {/* ── Print Modal ── */}
      {printing && (
        <PrintSlipModal
          title={`KOT #${printing.number}`}
          subtitle={`Table ${printing.table_number}`}
          onClose={() => setPrinting(null)}
        >
          <ThermalKOT kot={printing} />
        </PrintSlipModal>
      )}
    </div>
  )
}

/* ── KOT Card ───────────────────────────────────────────────────────── */
function KOTCard({ kot, onPrint }) {
  const time = new Date(kot.created_at)
  const minutesAgo = Math.floor((Date.now() - time) / 60000)
  const isUrgent = minutesAgo >= 15
  const isWarn = minutesAgo >= 8 && !isUrgent
  const totalItems = kot.items.reduce((n, l) => n + l.quantity, 0)

  return (
    <article
      className={[
        'flex flex-col rounded-2xl border-2 bg-white shadow-sm transition-all hover:shadow-md',
        isUrgent ? 'border-rose-400 shadow-rose-100' : isWarn ? 'border-amber-300' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Card Header */}
      <header
        className={[
          'flex items-center justify-between rounded-t-xl px-4 py-3 border-b',
          isUrgent
            ? 'bg-rose-50 border-rose-100'
            : isWarn
            ? 'bg-amber-50 border-amber-100'
            : 'bg-slate-50 border-slate-100',
        ].join(' ')}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-black text-slate-900">
              Table {kot.table_number}
            </p>
            <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
              #{kot.number}
            </span>
          </div>
          <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1 ${isUrgent ? 'text-rose-600' : isWarn ? 'text-amber-600' : 'text-slate-400'}`}>
            <svg className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {minutesAgo > 0 && ` · ${minutesAgo}m ago`}
            {isUrgent && ' ⚠ URGENT'}
          </p>
        </div>

        <button
          onClick={onPrint}
          title="Print KOT"
          className={`rounded-xl p-2 transition-all ${
            isUrgent
              ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
              : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 border border-slate-200'
          }`}
        >
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" rx="1" />
          </svg>
        </button>
      </header>

      {/* Items List */}
      <ul className="flex-1 space-y-1 px-4 py-3">
        {kot.items.map((line) => (
          <li key={line.id} className="flex items-start gap-2.5 text-sm">
            <span className="tabular shrink-0 min-w-[28px] rounded-lg bg-slate-900 px-1.5 py-0.5 text-center text-[11px] font-black text-white">
              {line.quantity}×
            </span>
            <span className="flex-1 text-slate-800">
              <span className="font-semibold">{line.item_name}</span>
              {line.portion === 'HALF' && (
                <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-black uppercase text-slate-500">Half</span>
              )}
              {line.portion === 'FULL' && (
                <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-black uppercase text-slate-500">Full</span>
              )}
              {line.note && (
                <span className="mt-0.5 block text-xs text-amber-700 italic">
                  ↳ {line.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Card Footer */}
      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">
          {kot.created_by_name}
        </span>
      </footer>
    </article>
  )
}
