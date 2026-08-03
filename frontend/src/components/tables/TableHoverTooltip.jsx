import { useState } from 'react'
import { money } from '@/utils/format'
import { TABLE_STATUS } from '@/services/tables'

export default function TableHoverTooltip({ table, children, className = '', style }) {
  const [hovered, setHovered] = useState(false)

  const summary = table?.order_summary
  const tone = TABLE_STATUS[table?.status] ?? TABLE_STATUS.AVAILABLE
  const hasItems = summary && summary.items && summary.items.length > 0

  return (
    <div
      className={`relative inline-block ${className}`}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}

      {hovered && (
        <div className="absolute left-1/2 bottom-full z-50 mb-3 w-80 -translate-x-1/2 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
          <div className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700/90 pb-3">
              <span className="font-extrabold text-base text-white tracking-wide">
                🍽️ Table {table.number}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                  table.status === 'OCCUPIED'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                    : table.status === 'BILLED'
                    ? 'bg-blue-500/25 text-blue-300 border border-blue-500/50'
                    : 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                }`}
              >
                <span className={`size-2 rounded-full ${tone.dot}`} />
                {tone.label}
              </span>
            </div>

            {/* Customer Info (if attached) */}
            {summary?.customer_name && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800/90 p-2.5 text-xs border border-slate-700">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <span>👤</span>
                  <span className="truncate">{summary.customer_name}</span>
                </span>
                <span className="text-slate-400 font-mono font-medium">{summary.customer_phone}</span>
              </div>
            )}

            {/* Items List */}
            {hasItems ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Items Ordered ({summary.item_count})</span>
                  <span>Amount</span>
                </div>

                <ul className="max-h-52 overflow-y-auto divide-y divide-slate-800/80 pr-1 text-sm scroll-thin">
                  {summary.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2 pr-2 font-semibold text-slate-100 min-w-0">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-xs font-bold text-amber-400">
                          {item.quantity}×
                        </span>
                        <span className="truncate">
                          {item.name}
                          {item.portion === 'HALF' && (
                            <span className="text-xs font-normal text-slate-400 ml-1">(Half)</span>
                          )}
                        </span>
                      </div>
                      <span className="tabular font-bold text-slate-200 text-sm shrink-0">
                        {money(item.line_total)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Total Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-700/90 pt-3 text-sm font-bold">
                  <span className="text-slate-300">Running Subtotal:</span>
                  <span className="tabular text-emerald-400 text-base font-black">
                    {money(summary.subtotal)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs font-medium text-slate-400">
                {table.status === 'AVAILABLE' ? (
                  <span className="text-emerald-400 font-semibold">✨ Table is Available ({table.seats} seats)</span>
                ) : (
                  <span>No items added to order yet</span>
                )}
              </div>
            )}
          </div>

          {/* Pointer Triangle */}
          <div className="mx-auto -mt-1.5 size-3 rotate-45 border-r-2 border-b-2 border-slate-700 bg-slate-900" />
        </div>
      )}
    </div>
  )
}
