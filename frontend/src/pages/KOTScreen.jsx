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

  // Ready states for quick UI feedback
  const [readyKots, setReadyKots] = useState(new Set())

  // History state
  const [historyRows, setHistoryRows] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [datePreset, setDatePreset] = useState('Today') // 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Date' | 'All Time' | 'This Month' | 'Last Month' | 'This Quarter' | 'Custom Range'
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  // Pagination state for History
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // Printing modal
  const [printing, setPrinting] = useState(null)

  // Date slider horizontal scroll ref
  const dateSliderRef = useRef(null)

  // ── Load Live Tickets ────────────────────────────────────────────────
  const loadLive = useCallback(
    async ({ announce = false } = {}) => {
      try {
        const data = await kotApi.list()
        if (announce && seenIds.current) {
          const fresh = data.filter((k) => !seenIds.current.has(k.id))
          if (fresh.length) {
            toast.info(`🔔 New KOT — Table ${fresh[0].table_number || fresh[0].tag_name || 'Takeaway'}`)
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
    setPage(1)
    try {
      const params = { history: 'true' }

      if (datePreset === 'Today') {
        params.date = new Date().toISOString().slice(0, 10)
      } else if (datePreset === 'Yesterday') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        params.date = d.toISOString().slice(0, 10)
      } else if (datePreset === 'Last 7 Days') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        params.start_date = d.toISOString().slice(0, 10)
        params.end_date = new Date().toISOString().slice(0, 10)
      } else if (datePreset === 'Last 30 Days') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        params.start_date = d.toISOString().slice(0, 10)
        params.end_date = new Date().toISOString().slice(0, 10)
      } else if (datePreset === 'This Month') {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        params.start_date = firstDay.toISOString().slice(0, 10)
        params.end_date = now.toISOString().slice(0, 10)
      } else if (datePreset === 'Last Month') {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
        params.start_date = firstDay.toISOString().slice(0, 10)
        params.end_date = lastDay.toISOString().slice(0, 10)
      } else if (datePreset === 'This Quarter') {
        const now = new Date()
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3
        const firstDay = new Date(now.getFullYear(), quarterMonth, 1)
        params.start_date = firstDay.toISOString().slice(0, 10)
        params.end_date = now.toISOString().slice(0, 10)
      } else if (datePreset === 'Custom Date' || datePreset === 'Custom Range') {
        if (startDate) params.start_date = startDate
        if (endDate) params.end_date = endDate
      } else if (datePreset === 'All Time') {
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
  }, [])

  // Auto-fetch history when tab or primary filters change
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, datePreset, statusFilter, loadHistory])

  // Horizontal scroll helper for date filters
  const scrollDateFilters = (direction) => {
    if (!dateSliderRef.current) return
    const scrollAmount = 180
    dateSliderRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // Handle Mark Ready toggle
  const handleMarkReady = (kotId) => {
    setReadyKots((prev) => {
      const next = new Set(prev)
      if (next.has(kotId)) {
        next.delete(kotId)
      } else {
        next.add(kotId)
        toast.success(`KOT #${kotId} marked ready & sent to service station!`)
      }
      return next
    })
  }

  // Export CSV for KOT History
  const exportHistoryCSV = () => {
    const records = activeTab === 'history' ? (historyRows || []) : (liveRows || [])
    if (records.length === 0) {
      toast.info('No KOT records to export.')
      return
    }

    const headers = ['KOT Number', 'Date', 'Time', 'Table / Tag', 'Order Status', 'Item Name', 'Portion', 'Quantity', 'Note', 'Staff']
    const rows = []

    records.forEach((kot) => {
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
    link.setAttribute('download', `kot_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`KOT ${activeTab} exported to CSV!`)
  }

  // Active records depending on tab
  const currentRows = activeTab === 'live' ? (liveRows || []) : (historyRows || [])

  // Filtered live rows if search query is typed on live screen
  const filteredLiveRows = useMemo(() => {
    if (!liveRows) return []
    return liveRows.filter((kot) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        String(kot.number).includes(q) ||
        (kot.table_number && String(kot.table_number).includes(q)) ||
        (kot.tag_name && kot.tag_name.toLowerCase().includes(q)) ||
        (kot.created_by_name && kot.created_by_name.toLowerCase().includes(q)) ||
        kot.items.some((i) => i.item_name.toLowerCase().includes(q))

      const minutesAgo = Math.floor((Date.now() - new Date(kot.created_at)) / 60000)
      const isUrgent = minutesAgo >= 15

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'URGENT' && isUrgent) ||
        (statusFilter === 'RUNNING' && !isUrgent) ||
        statusFilter === kot.order_status

      return matchesSearch && matchesStatus
    })
  }, [liveRows, searchQuery, statusFilter])

  // KPI Calculations
  const totalKotsCount = currentRows.length
  const totalItemsCount = currentRows.reduce((sum, kot) => sum + kot.items.reduce((s, i) => s + i.quantity, 0), 0)
  const tablesServedCount = new Set(currentRows.map((k) => k.table_number).filter(Boolean)).size
  const staffCount = new Set(currentRows.map((k) => k.created_by_name).filter(Boolean)).size || 1

  // Urgent tickets count on live
  const urgentTickets = (liveRows || []).filter(
    (k) => Math.floor((Date.now() - new Date(k.created_at)) / 60000) >= 15
  )

  // Paginated History Data Calculation
  const totalCount = historyRows ? historyRows.length : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginatedHistoryRows = useMemo(() => {
    if (!historyRows) return []
    return historyRows.slice((page - 1) * pageSize, page * pageSize)
  }, [historyRows, page, pageSize])

  if (liveRows === null) return <PageLoader label="Loading kitchen tickets…" />

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] text-slate-800 p-3 sm:p-6 lg:p-8">
      {/* Styles for Animations and Scrollbars */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 7px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        .urgent-badge-pulse {
          animation: pulse-ring 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="max-w-[1440px] mx-auto space-y-5">
        {/* ── BEGIN: Header Section ── */}
        <header className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Title & Sub-information */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Kitchen Order Tickets
                </h1>
                {activeTab === 'live' && urgentTickets.length > 0 && (
                  <span className="urgent-badge-pulse inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span>{urgentTickets.length} Urgent</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-400">
                {activeTab === 'live'
                  ? `${liveRows.length} active tickets · Auto-refreshes every ${POLL_MS / 1000}s · Last updated ${lastRefresh.toLocaleTimeString('en-IN')}`
                  : 'Browse, search, and reprint previous kitchen tickets across all dates.'}
              </p>
            </div>

            {/* Top Right Switch Tabs */}
            <div className="flex items-center self-start lg:self-auto p-1.5 bg-slate-100/70 border border-slate-200/80 rounded-2xl shadow-inner gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === 'live'
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <span>Live Kitchen ({liveRows.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span>KOT History</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── BEGIN: Elevated Modern KPI Summary Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total KOTs */}
          <div className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total KOTs</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{totalKotsCount}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </span>
            </div>
          </div>

          {/* Card 2: Total Items */}
          <div className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total Items</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-3xl sm:text-4xl font-black text-indigo-600 tracking-tight">{totalItemsCount}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200/60 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Active queued
              </span>
            </div>
          </div>

          {/* Card 3: Tables Served */}
          <div className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Tables Served</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">{tablesServedCount}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Floor active
              </span>
            </div>
          </div>

          {/* Card 4: Staff Involved */}
          <div className="relative bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Staff Involved</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-xs group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="text-3xl sm:text-4xl font-black text-purple-600 tracking-tight">{staffCount}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200/60 shadow-2xs">
                <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Staff online
              </span>
            </div>
          </div>
        </section>

        {/* ── BEGIN: Filter & Action Toolbar ── */}
        <section className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 select-none">
          {/* Left: Date Filter Sliding Carousel */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-full lg:max-w-[58%] relative bg-slate-50/70 p-1 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              aria-label="Previous date options"
              onClick={() => scrollDateFilters('left')}
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-white text-slate-500 hover:text-slate-900 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs active:scale-95 transition-all z-10 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>

            {/* Smooth Scroll Container */}
            <div
              ref={dateSliderRef}
              className="relative flex-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-1.5 whitespace-nowrap relative z-10">
                {[
                  'Today',
                  'Yesterday',
                  'Last 7 Days',
                  'Last 30 Days',
                  'Custom Date',
                  'All Time',
                  'This Month',
                  'Last Month',
                  'This Quarter',
                  'Custom Range',
                ].map((preset) => {
                  const isActive = datePreset === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDatePreset(preset)
                        setPage(1)
                      }}
                      className={`relative z-10 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                    >
                      {preset === 'Custom Date' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      <span>{preset}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              aria-label="Next date options"
              onClick={() => scrollDateFilters('right')}
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-white text-slate-500 hover:text-slate-900 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs active:scale-95 transition-all z-10 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>
          </div>

          {/* Right: Search, Filter, View Toggles & Export */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 justify-end">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (activeTab === 'history' ? loadHistory() : null)}
                placeholder="Search KOT #, Table..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 text-slate-900 transition-all outline-hidden font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50/70 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden pr-7"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">Running</option>
              <option value="URGENT">Urgent</option>
              <option value="BILLED">Billed</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Search Action Button */}
            <button
              type="button"
              onClick={() => (activeTab === 'history' ? loadHistory() : null)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all flex items-center gap-1 cursor-pointer"
            >
              Search
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />

            {/* View Toggle (Grid / List) */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportHistoryCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </section>

        {/* Custom Date Range Picker bar if Custom Date or Custom Range selected */}
        {(datePreset === 'Custom Date' || datePreset === 'Custom Range') && (
          <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
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
              type="button"
              onClick={loadHistory}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ── LIVE KITCHEN VIEW ─────────────────────────────────────────── */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            {/* Urgent Attention Cards if any */}
            {urgentTickets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-rose-700">
                    Urgent Attention Required (&gt;15 mins)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {urgentTickets.map((kot) => {
                    const time = new Date(kot.created_at)
                    const minutesAgo = Math.floor((Date.now() - time) / 60000)
                    const isReady = readyKots.has(kot.id)
                    const totalItems = kot.items.reduce((s, i) => s + i.quantity, 0)

                    return (
                      <div
                        key={`urgent-${kot.id}`}
                        className="ticket-card bg-rose-50/50 hover:bg-rose-50 border-2 border-rose-300 rounded-2xl shadow-xs transition-all duration-200 overflow-hidden flex flex-col justify-between"
                      >
                        <div className="p-4 sm:p-5 space-y-3.5">
                          {/* Card Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-slate-900">
                                  {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
                                </span>
                                <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                  #{kot.number}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-rose-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                </svg>
                                <span>
                                  {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {minutesAgo}m ago
                                </span>
                                <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-wide flex items-center gap-1">
                                  ⚠ URGENT
                                </span>
                              </div>
                            </div>

                            {/* Print Button */}
                            <button
                              type="button"
                              onClick={() => setPrinting(kot)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 cursor-pointer"
                              title="Print Urgent Slip"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </button>
                          </div>

                          {/* Ticket Items */}
                          <div className="pt-3 border-t border-rose-200/70 space-y-1.5">
                            {kot.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                                <span className="inline-flex items-center justify-center bg-slate-900 text-white text-xs font-black px-1.5 py-0.5 rounded-md">
                                  {item.quantity}×
                                </span>
                                <span className="text-slate-900">{item.item_name}</span>
                                {item.portion && (
                                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-md tracking-wider">
                                    {item.portion_display || item.portion}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="p-4 sm:p-5 pt-3 border-t border-rose-200/70 flex items-center justify-between text-xs text-slate-500 bg-rose-100/30">
                          <span className="font-bold tracking-wider uppercase text-[11px] text-slate-600">
                            {totalItems} ITEM{totalItems !== 1 ? 'S' : ''}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-medium">{kot.created_by_name || 'Staff'}</span>
                            <button
                              type="button"
                              onClick={() => handleMarkReady(kot.id)}
                              className={`px-3 py-1 text-xs font-bold text-white rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer ${
                                isReady
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-rose-600 hover:bg-rose-700'
                              }`}
                            >
                              {isReady ? 'Ready ✓' : 'Mark Ready ✓'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Standard Running Tickets Feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  Active Running Tickets ({filteredLiveRows.length})
                </h3>
                <span className="text-xs text-slate-500">
                  Showing all active orders
                </span>
              </div>

              {filteredLiveRows.length === 0 ? (
                <EmptyState
                  icon="👨‍🍳"
                  title="No active kitchen tickets"
                  hint="New tickets punched from POS will appear here automatically in real time."
                />
              ) : (
                <div
                  className={
                    viewMode === 'list'
                      ? 'flex flex-col gap-3'
                      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  }
                >
                  {filteredLiveRows.map((kot) => {
                    const time = new Date(kot.created_at)
                    const minutesAgo = Math.floor((Date.now() - time) / 60000)
                    const isUrgent = minutesAgo >= 15
                    const isWarn = minutesAgo >= 8 && !isUrgent
                    const isReady = readyKots.has(kot.id)
                    const totalItems = kot.items.reduce((s, i) => s + i.quantity, 0)

                    return (
                      <div
                        key={kot.id}
                        className={`ticket-card bg-white rounded-2xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-lg transition-all duration-200 group ${
                          isUrgent ? 'border-rose-300 bg-rose-50/20' : isWarn ? 'border-amber-200' : 'border-slate-200'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900">
                                  {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
                                </h4>
                                <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                  #{kot.number}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                {minutesAgo > 0 && ` · ${minutesAgo}m ago`}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isUrgent
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isWarn
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {isUrgent ? 'Urgent' : 'Running'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setPrinting(kot)}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Print KOT"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Items List */}
                          <div className="pt-3 border-t border-slate-100 space-y-2">
                            {kot.items.map((line) => (
                              <div key={line.id} className="flex items-center gap-2 text-sm text-slate-800">
                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-xs font-semibold px-1.5 py-0.5 rounded-md min-w-[24px]">
                                  {line.quantity}×
                                </span>
                                <span className="truncate font-medium">{line.item_name}</span>
                                {line.portion && line.portion !== 'FULL' && (
                                  <span className="text-[10px] uppercase font-bold text-slate-400">({line.portion_display || line.portion})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-600">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                          <div className="flex items-center gap-2">
                            <span>By: <strong className="text-slate-600 font-medium">{kot.created_by_name || 'Staff'}</strong></span>
                            <button
                              type="button"
                              onClick={() => handleMarkReady(kot.id)}
                              className={`px-2.5 py-0.5 text-[11px] font-bold text-white rounded-md shadow-2xs transition-all cursor-pointer ${
                                isReady
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {isReady ? 'Ready ✓' : 'Ready'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ── HISTORIC KOT SECTION ───────────────────────────────────────── */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-base font-bold text-slate-800">
                Archived &amp; Historic Tickets
              </h3>
              <span className="text-xs text-slate-500">
                Showing {totalCount} tickets
              </span>
            </div>

            {loadingHistory ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
                <PageLoader label="Fetching KOT history records…" />
              </div>
            ) : !historyRows || historyRows.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">No matching tickets found</h3>
                <p className="mt-1 text-xs text-slate-500">Try changing your search query or reset date/status filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('ALL')
                    setDatePreset('Today')
                    loadHistory()
                  }}
                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {/* Grid / List Cards */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {paginatedHistoryRows.map((kot) => {
                      const dt = new Date(kot.created_at)
                      const totalItems = kot.items.reduce((s, i) => s + i.quantity, 0)

                      return (
                        <div
                          key={kot.id}
                          className="ticket-card bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-lg transition-all group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-bold text-slate-900">
                                    {kot.table_number ? `Table ${kot.table_number}` : kot.tag_name || 'Takeaway'}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                    #{kot.number}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <OrderStatusBadge status={kot.order_status} label={kot.order_status_display} />
                                <button
                                  type="button"
                                  onClick={() => setPrinting(kot)}
                                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Reprint KOT"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="pt-3 border-t border-slate-100 space-y-2">
                              {kot.items.map((line) => (
                                <div key={line.id} className="flex items-center gap-2 text-sm text-slate-800">
                                  <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-xs font-semibold px-1.5 py-0.5 rounded-md min-w-[24px]">
                                    {line.quantity}×
                                  </span>
                                  <span className="truncate font-medium">{line.item_name}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                            <span>By: <strong className="text-slate-600 font-medium">{kot.created_by_name || 'Staff'}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Table View */
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
                          {paginatedHistoryRows.map((kot) => {
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
                                    type="button"
                                    onClick={() => setPrinting(kot)}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
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
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage(1)}
                        title="First Page"
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                      >
                        Previous
                      </button>

                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 border border-slate-200">
                        Page {page} of {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage(totalPages)}
                        title="Last Page"
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
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
      </main>
    </div>
  )
}

/* ── Order Status Badge Component ──────────────────────────────────── */
function OrderStatusBadge({ status, label }) {
  const display = label || status || 'RUNNING'
  switch (status) {
    case 'RUNNING':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          Running
        </span>
      )
    case 'BILLED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Billed
        </span>
      )
    case 'PAID':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
          Paid
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Cancelled
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {display}
        </span>
      )
  }
}
