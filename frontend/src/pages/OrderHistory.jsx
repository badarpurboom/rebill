import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { bills as billApi, BILL_STATUS_TONE, PAYMENT_MODES } from '@/services/billing'
import { dateTime, money } from '@/utils/format'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Misc'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import ThermalBill from '@/components/print/ThermalBill'
import CancelBillModal from '@/components/orders/CancelBillModal'
import ImportBillsModal from '@/components/orders/ImportBillsModal'

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PERIOD_PRESETS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: '📅 Today' },
  { value: 'week', label: '🗓️ This Week' },
  { value: 'month', label: '📆 This Month' },
  { value: '6_months', label: '📊 6 Months' },
  { value: '1_year', label: '📈 1 Year' },
  { value: 'custom', label: '🎯 Custom Range' },
]

export default function OrderHistory() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('')
  const [period, setPeriod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewing, setViewing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (status) params.status = status
      if (mode) params.payment_mode = mode
      if (period) params.period = period
      if (period === 'custom') {
        if (dateFrom) params.from = dateFrom
        if (dateTo) params.to = dateTo
      }
      const data = await billApi.list(params)
      setRows(data.results)
      setCount(data.count)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load order history.'))
      setRows([])
    }
  }, [search, status, mode, period, dateFrom, dateTo, toast])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const openBill = async (row) => {
    try {
      setViewing(await billApi.get(row.id))
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load bill details.'))
    }
  }

  const handleExport = () => {
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (status) params.status = status
    if (mode) params.payment_mode = mode
    if (period) params.period = period
    if (period === 'custom') {
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
    }
    billApi.exportFile(params)
    toast.success('Downloading Bills CSV export…')
  }

  if (rows === null) return <PageLoader label="Loading order history…" />

  const totalCollected = rows
    .filter((b) => b.status === 'PAID')
    .reduce((sum, b) => sum + Number(b.net_payable), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order History</h1>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-black text-slate-700">
              {count} Bills
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Filter, search and export billing records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalCollected > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Period Total</span>
              <p className="tabular text-base font-black text-emerald-700">{money(totalCollected)}</p>
            </div>
          )}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            📥 Export CSV
          </button>
          {isOwner && (
            <button
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              📤 Import CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill #, customer name or phone…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
          </div>

          {/* Period */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all w-36 shrink-0 cursor-pointer"
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all w-32 shrink-0 cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Payment Mode */}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all w-36 shrink-0 cursor-pointer"
          >
            <option value="">All Payments</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
            ))}
          </select>
        </div>

        {/* Custom Date Range */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 transition-all"
            />
            <span className="text-xs font-semibold text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 transition-all"
            />
          </div>
        )}
      </div>

      {/* ── Orders Table ── */}
      {rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No bills found"
          hint={
            search || status || mode || period
              ? 'Try adjusting your filters or date range.'
              : 'Completed orders and bills will appear here.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Bill # &amp; Date</th>
                <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Customer</th>
                <th className="w-20 px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Items</th>
                <th className="w-32 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="w-36 px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Status</th>
                <th className="w-24 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((bill) => (
                <tr
                  key={bill.id}
                  className={`group transition-colors hover:bg-slate-50/70 ${
                    bill.status === 'CANCELLED' ? 'opacity-50' : ''
                  }`}
                >
                  {/* Bill # & Date */}
                  <td className="px-5 py-3.5 cursor-pointer" onClick={() => openBill(bill)}>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{bill.bill_number}</span>
                      {bill.order_type === 'TAKEAWAY' && (
                        <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-black text-amber-600">
                          🛍️ Takeaway
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      {bill.order_type === 'TAKEAWAY' ? 'Counter' : `Table ${bill.table_number}`} · {dateTime(bill.created_at)}
                    </p>
                  </td>

                  {/* Customer */}
                  <td className="cursor-pointer px-5 py-3.5" onClick={() => openBill(bill)}>
                    {bill.customer_name ? (
                      <>
                        <p className="font-extrabold text-slate-900">{bill.customer_name}</p>
                        <p className="tabular text-xs font-semibold text-slate-400">{bill.customer_phone}</p>
                      </>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>

                  {/* Items count */}
                  <td className="tabular px-5 py-3.5 text-center font-extrabold text-slate-700">
                    {bill.item_count}
                  </td>

                  {/* Amount */}
                  <td className="cursor-pointer px-5 py-3.5 text-right" onClick={() => openBill(bill)}>
                    <p className="tabular font-black text-slate-900">{money(bill.net_payable)}</p>
                    {Number(bill.redeem_amount) > 0 && (
                      <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                        ⭐ {bill.points_redeemed} pts used
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={BILL_STATUS_TONE[bill.status]}>{bill.status_display}</Badge>
                    {bill.payment_mode && (
                      <p className="mt-1 text-[10px] font-extrabold text-slate-400 uppercase">
                        {bill.payment_mode_display}
                      </p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openBill(bill)}
                        title="Print Bill"
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                      >
                        🖨️
                      </button>
                      {bill.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setCancelling(bill)}
                          title="Cancel Bill"
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {viewing && (
        <PrintSlipModal
          title={`Bill ${viewing.bill_number}`}
          subtitle={`Table ${viewing.table_number} · ${viewing.status_display}`}
          onClose={() => setViewing(null)}
        >
          <ThermalBill bill={viewing} />
        </PrintSlipModal>
      )}

      {cancelling && (
        <CancelBillModal
          bill={cancelling}
          isOwner={isOwner}
          onClose={() => setCancelling(null)}
          onCancelled={(updated) => {
            setCancelling(null)
            toast.success(`${updated.bill_number} cancelled`)
            load()
          }}
        />
      )}

      {importing && (
        <ImportBillsModal
          onClose={() => setImporting(false)}
          onDone={() => { load() }}
        />
      )}
    </div>
  )
}
