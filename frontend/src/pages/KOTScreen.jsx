import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { kots as kotApi } from '@/services/billing'
import { EmptyState, PageLoader } from '@/components/ui/Misc'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import ThermalKOT from '@/components/print/ThermalKOT'

const POLL_MS = 10000

export default function KOTScreen() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('live') // 'live' | 'history'

  // Live tickets state
  const [liveRows, setLiveRows] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const seenIds = useRef(null)

  // History state
  const [historyRows, setHistoryRows] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [datePreset, setDatePreset] = useState('today') // 'today' | 'yesterday' | '7days' | '30days' | 'custom' | 'all'
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  // Pagination state for History
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // Printing modal
  const [printing, setPrinting] = useState(null)

  // ── Load Live Tickets ────────────────────────────────────────────────
  const loadLive = useCallback(
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
        setLiveRows(data)
        setLastRefresh(new Date())
      } catch (error) {
        if (liveRows === null) toast.error(errorMessage(error, 'Failed to load KOT list.'))
      }
    },
    [toast, liveRows],
  )

  // ── Load History Tickets ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    setPage(1) // Reset to first page on reload/filter
    try {
      const params = { history: 'true' }

      if (datePreset === 'today') {
        const today = new Date().toISOString().slice(0, 10)
        params.date = today
      } else if (datePreset === 'yesterday') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        params.date = d.toISOString().slice(0, 10)
      } else if (datePreset === '7days') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        params.start_date = d.toISOString().slice(0, 10)
        params.end_date = new Date().toISOString().slice(0, 10)
      } else if (datePreset === '30days') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        params.start_date = d.toISOString().slice(0, 10)
        params.end_date = new Date().toISOString().slice(0, 10)
      } else if (datePreset === 'custom') {
        if (startDate) params.start_date = startDate
        if (endDate) params.end_date = endDate
      } else if (datePreset === 'all') {
        params.all_time = 'true'
      }

      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      const data = await kotApi.list(params)
      setHistoryRows(data)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load KOT history.'))
    } finally {
      setLoadingHistory(false)
    }
  }, [datePreset, startDate, endDate, statusFilter, searchQuery, toast])

  // Polling for live screen
  useEffect(() => {
    loadLive()
    const id = setInterval(() => loadLive({ announce: true }), POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-fetch history when tab or primary filters change
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, datePreset, statusFilter, loadHistory])

  // Paginated History Data Calculation
  const totalCount = historyRows ? historyRows.length : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginatedRows = useMemo(() => {
    if (!historyRows) return []
    const start = (page - 1) * pageSize
    return historyRows.slice(start, start + pageSize)
  }, [historyRows, page, pageSize])

  // Export CSV for KOT History
  const exportHistoryCSV = () => {
    if (!historyRows || historyRows.length === 0) {
      toast.info('No KOT records to export.')
      return
    }

    const headers = ['KOT Number', 'Date', 'Time', 'Table / Tag', 'Order Status', 'Item Name', 'Portion', 'Quantity', 'Note', 'Staff']
    const rows = []

    historyRows.forEach((kot) => {
      const dt = new Date(kot.created_at)
      const dateStr = dt.toLocaleDateString('en-IN')
      const timeStr = dt.toLocaleTimeString('en-IN')

      kot.items.forEach((item) => {
        rows.push([
          `#${kot.number}`,
          dateStr,
          timeStr,
          kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway',
          kot.order_status_display || kot.order_status || 'Running',
          `"${item.item_name.replace(/"/g, '""')}"`,
          item.portion_display || item.portion,
          item.quantity,
          item.note ? `"${item.note.replace(/"/g, '""')}"` : '',
          kot.created_by_name || '',
        ])
      })
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `kot_history_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('KOT history exported to CSV!')
  }

  if (liveRows === null) return <PageLoader label="Loading kitchen tickets…" />

  const urgent = liveRows.filter((k) => Math.floor((Date.now() - new Date(k.created_at)) / 60000) >= 15).length
  const pending = liveRows.length

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* ── Top Header & Tab Switcher ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kitchen Order Tickets</h1>
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-black text-indigo-700">
                KOT Management
              </span>
              {activeTab === 'live' && urgent > 0 && (
                <span className="rounded-full bg-rose-50 border border-rose-300 px-2.5 py-0.5 text-xs font-black text-rose-600 animate-pulse">
                  ⚠ {urgent} Urgent
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {activeTab === 'live'
                ? `${pending} active tickets · Auto-refreshes every ${POLL_MS / 1000}s · Last updated ${lastRefresh.toLocaleTimeString('en-IN')}`
                : 'Browse, search, and reprint previous kitchen tickets across any date.'}
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1.5 border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'live'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              Live Kitchen ({pending})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              KOT History
            </button>
          </div>
        </div>

        {/* Live tab stats strip */}
        {activeTab === 'live' && liveRows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span><strong className="text-slate-900">{liveRows.length - urgent}</strong> On Time</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-rose-500" />
              <span><strong className="text-slate-900">{urgent}</strong> Overdue (&gt;15m)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="size-2 rounded-full bg-slate-400" />
              <span><strong className="text-slate-900">{liveRows.reduce((n, k) => n + k.items.reduce((s, l) => s + l.quantity, 0), 0)}</strong> Total Items</span>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: LIVE KITCHEN ───────────────────────────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'live' && (
        <>
          {liveRows.length === 0 ? (
            <EmptyState
              icon="👨‍🍳"
              title="No active KOT tickets"
              hint="Kitchen tickets will appear here automatically when items are sent from the POS terminal."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {liveRows.map((kot) => (
                <KOTCard key={kot.id} kot={kot} onPrint={() => setPrinting(kot)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: KOT HISTORY ────────────────────────────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Controls Bar */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Date Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'Last 30 Days' },
                  { id: 'custom', label: 'Custom Date' },
                  { id: 'all', label: 'All Time' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setDatePreset(preset.id)
                      setPage(1)
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      datePreset === preset.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* View toggle & Export */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                    className={`rounded-md p-1.5 transition-all ${
                      viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    title="Table View"
                    className={`rounded-md p-1.5 transition-all ${
                      viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={exportHistoryCSV}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <svg className="size-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Custom Date Pickers */}
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setPage(1)
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setPage(1)
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  />
                </div>
                <button
                  onClick={loadHistory}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Apply Dates
                </button>
              </div>
            )}

            {/* Search and Status Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100">
              {/* Search Bar */}
              <div className="relative flex-1">
                <svg className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search KOT #, Table, Item name, Staff..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RUNNING">🟢 Running</option>
                  <option value="BILLED">🟠 Billed</option>
                  <option value="PAID">🔵 Paid</option>
                  <option value="CANCELLED">🔴 Cancelled</option>
                </select>

                <button
                  onClick={loadHistory}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shrink-0"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* History Content */}
          {loadingHistory ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
              <PageLoader label="Fetching KOT history records…" />
            </div>
          ) : !historyRows || historyRows.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No KOT tickets found"
              hint="Try selecting a different date range or clearing the search filters."
            />
          ) : (
            <>
              {/* Summary Stats Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total KOTs</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{historyRows.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Items</p>
                  <p className="text-lg font-black text-indigo-600 mt-0.5">
                    {historyRows.reduce((sum, kot) => sum + kot.items.reduce((s, i) => s + i.quantity, 0), 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-black uppercase text-slate-400">Tables Served</p>
                  <p className="text-lg font-black text-emerald-600 mt-0.5">
                    {new Set(historyRows.map((k) => k.table_number)).size}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-black uppercase text-slate-400">Staff Involved</p>
                  <p className="text-lg font-black text-purple-600 mt-0.5">
                    {new Set(historyRows.map((k) => k.created_by_name)).size}
                  </p>
                </div>
              </div>

              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedRows.map((kot) => (
                    <HistoryKOTCard key={kot.id} kot={kot} onPrint={() => setPrinting(kot)} />
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">KOT #</th>
                          <th className="px-4 py-3">Table / Tag</th>
                          <th className="px-4 py-3">Date & Time</th>
                          <th className="px-4 py-3">Items Ordered</th>
                          <th className="px-4 py-3">Order Status</th>
                          <th className="px-4 py-3">Created By</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {paginatedRows.map((kot) => {
                          const dt = new Date(kot.created_at)
                          return (
                            <tr key={kot.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 font-black text-slate-900">
                                #{kot.number}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-800">
                                {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                <div className="max-w-xs space-y-0.5">
                                  {kot.items.map((line) => (
                                    <div key={line.id} className="truncate">
                                      <span className="font-bold text-slate-900">{line.quantity}×</span> {line.item_name}
                                      {line.portion && line.portion !== 'FULL' && ` (${line.portion_display || line.portion})`}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <OrderStatusBadge status={kot.order_status} label={kot.order_status_display} />
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {kot.created_by_name}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setPrinting(kot)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                                >
                                  Reprint
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Pagination Controls Bar ── */}
              {totalCount > pageSize && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-xs">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                    <span>
                      Showing <strong className="text-slate-900">{(page - 1) * pageSize + 1}</strong> to{' '}
                      <strong className="text-slate-900">{Math.min(page * pageSize, totalCount)}</strong> of{' '}
                      <strong className="text-slate-900">{totalCount}</strong> tickets
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Per page:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setPage(1)
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 focus:outline-hidden"
                      >
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-center sm:self-auto">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(1)}
                      title="First Page"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                    >
                      «
                    </button>
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                    >
                      Previous
                    </button>

                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 border border-slate-200">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                    >
                      Next
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                      title="Last Page"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Print Slip Modal ── */}
      {printing && (
        <PrintSlipModal
          title={`KOT #${printing.number}`}
          subtitle={printing.table_number ? `Table ${printing.table_number}` : printing.tag_name || 'Takeaway'}
          onClose={() => setPrinting(null)}
        >
          <ThermalKOT kot={printing} />
        </PrintSlipModal>
      )}
    </div>
  )
}

/* ── Live KOT Card Component ────────────────────────────────────────── */
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
              {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
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
      <ul className="flex-1 space-y-1.5 px-4 py-3">
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

/* ── History KOT Card Component ─────────────────────────────────────── */
function HistoryKOTCard({ kot, onPrint }) {
  const dt = new Date(kot.created_at)
  const totalItems = kot.items.reduce((n, l) => n + l.quantity, 0)

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all hover:shadow-md">
      <header className="flex items-center justify-between rounded-t-xl px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-black text-slate-900">
              {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
            </p>
            <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
              #{kot.number}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })},{' '}
            {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <OrderStatusBadge status={kot.order_status} label={kot.order_status_display} />
          <button
            onClick={onPrint}
            title="Reprint KOT"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
          >
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Items List */}
      <ul className="flex-1 space-y-1.5 px-4 py-3">
        {kot.items.map((line) => (
          <li key={line.id} className="flex items-start gap-2 text-xs">
            <span className="tabular shrink-0 min-w-[24px] rounded-md bg-slate-100 border border-slate-200 px-1 py-0.5 text-center text-[10px] font-black text-slate-800">
              {line.quantity}×
            </span>
            <span className="flex-1 text-slate-800">
              <span className="font-semibold">{line.item_name}</span>
              {line.portion && line.portion !== 'FULL' && (
                <span className="ml-1 text-[9px] font-bold text-slate-400">({line.portion_display || line.portion})</span>
              )}
              {line.note && (
                <span className="block text-[10px] text-amber-600 italic">
                  ↳ {line.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2 bg-slate-50/50 rounded-b-2xl">
        <span className="text-[10px] font-bold text-slate-400">
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[120px]">
          By: {kot.created_by_name}
        </span>
      </footer>
    </article>
  )
}

/* ── Order Status Badge Component ──────────────────────────────────── */
function OrderStatusBadge({ status, label }) {
  const display = label || status || 'RUNNING'
  switch (status) {
    case 'RUNNING':
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
          Running
        </span>
      )
    case 'BILLED':
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 border border-amber-200">
          Billed
        </span>
      )
    case 'PAID':
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200">
          Paid
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200">
          Cancelled
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 border border-slate-200">
          {display}
        </span>
      )
  }
}
