import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { bills as billApi, BILL_STATUS_TONE, PAYMENT_MODES } from '@/services/billing'
import { dateTime, money } from '@/utils/format'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Misc'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import ThermalBill from '@/components/print/ThermalBill'
import CancelBillModal from '@/components/orders/CancelBillModal'

const ORDER_TYPES = [
  { value: '', label: 'All Orders' },
  { value: 'DINE_IN', label: '🍽️ Dine-In' },
  { value: 'TAKEAWAY', label: '🛍️ Takeaway' },
]

const STATUSES = [
  { value: '', label: 'All Statuses', icon: '⚡' },
  { value: 'PAID', label: 'Paid', icon: '🟢' },
  { value: 'UNPAID', label: 'Unpaid', icon: '🟡' },
  { value: 'CANCELLED', label: 'Cancelled', icon: '🔴' },
]

const PERIOD_PRESETS = [
  { value: '', label: 'All Time', icon: '♾️' },
  { value: 'today', label: 'Today', icon: '📅' },
  { value: 'yesterday', label: 'Yesterday', icon: '⏪' },
  { value: 'this_week', label: 'This Week', icon: '📊' },
  { value: 'last_week', label: 'Last Week', icon: '⏮️' },
  { value: 'last_7_days', label: 'Last 7 Days', icon: '🗓️' },
  { value: 'this_month', label: 'This Month', icon: '📆' },
  { value: 'last_month', label: 'Last Month', icon: '🗓️' },
  { value: 'last_30_days', label: 'Last 30 Days', icon: '📈' },
  { value: 'last_90_days', label: 'Last 90 Days', icon: '📊' },
  { value: '6_months', label: 'Last 6 Months', icon: '⏳' },
  { value: 'this_year', label: 'This Year', icon: '🏛️' },
  { value: 'custom', label: 'Custom Range', icon: '🎯' },
]

const ALL_PAYMENT_OPTIONS = [
  { value: '', label: 'All Payments', icon: '💳' },
  ...PAYMENT_MODES,
]

function ModernDropdown({ value, onChange, options, placeholder = 'Select...', width = 192 }) {
  const [open, setOpen] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [pos, setPos] = useState({ top: 0, left: 0, w: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  // Compute popup position from trigger button's bounding rect
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, w: Math.max(r.width, width) })
  }, [width])

  useEffect(() => {
    if (!open) return
    updatePos()
    const onScroll = () => updatePos()
    const onResize = () => updatePos()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, updatePos])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = options.find((o) => o.value === value) || options[0]
  const isFiltered = Boolean(value)

  const dropdownMenu = open && createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: pos.w,
        zIndex: 99999,
        backgroundColor: '#ffffff',
        border: '2px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        padding: '6px',
        maxHeight: '288px',
        overflowY: 'auto',
      }}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value
        const isHovered = hoveredIdx === idx
        return (
          <button
            key={opt.value}
            type="button"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => { onChange(opt.value); setOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              border: 'none',
              textAlign: 'left',
              marginBottom: '2px',
              transition: 'all 0.12s ease',
              ...(isSelected
                ? { background: 'linear-gradient(to right, #dc2626, #e11d48)', color: '#fff', boxShadow: '0 3px 10px rgba(220,38,38,0.3)' }
                : isHovered
                ? { background: 'linear-gradient(to right, #fee2e2, #fecaca)', color: '#b91c1c' }
                : { background: 'transparent', color: '#334155' }
              ),
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {opt.icon && <span>{opt.icon}</span>}
              <span>{opt.label}</span>
            </span>
            {isSelected && (
              <svg style={{ width: 14, height: 14, color: '#fff', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        )
      })}
    </div>,
    document.body
  )

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs select-none active:scale-95 ${
          open
            ? 'border-red-600 bg-white ring-4 ring-red-500/20 text-red-700 shadow-md'
            : isFiltered
            ? 'border-red-500 bg-red-50/80 text-red-900 hover:border-red-600 hover:bg-red-100 hover:shadow-md hover:ring-2 hover:ring-red-500/30'
            : 'border-slate-200 bg-slate-50/90 text-slate-700 hover:border-red-600 hover:bg-red-50/70 hover:text-red-700 hover:shadow-md hover:ring-2 hover:ring-red-500/30'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected?.icon && <span className="text-xs shrink-0">{selected.icon}</span>}
          <span className="truncate">{selected?.label || placeholder}</span>
        </span>
        <svg
          className={`size-3.5 transition-transform duration-200 shrink-0 ${open ? 'rotate-180 text-red-600' : 'text-slate-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {dropdownMenu}
    </div>
  )
}

export default function OrderHistory() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [orderType, setOrderType] = useState('')
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('')
  const [period, setPeriod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewing, setViewing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [page, setPage] = useState(1)

  const searchRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const params = { page }
      if (search.trim()) params.search = search.trim()
      if (orderType) params.order_type = orderType
      if (status) params.status = status
      if (mode) params.payment_mode = mode
      if (period) params.period = period
      if (period === 'custom') {
        if (dateFrom) params.from = dateFrom
        if (dateTo) params.to = dateTo
      }
      const data = await billApi.list(params)
      setRows(data.results || [])
      setCount(data.count || 0)
      if (data.summary) {
        setSummary(data.summary)
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load order history.'))
      setRows([])
    }
  }, [search, orderType, status, mode, period, dateFrom, dateTo, page, toast])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const fn = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

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
    if (orderType) params.order_type = orderType
    if (status) params.status = status
    if (mode) params.payment_mode = mode
    if (period) params.period = period
    if (period === 'custom') {
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
    }
    billApi.exportExcel(params)
    toast.success('Downloading Excel (.xlsx) file…')
  }

  // Summary KPIs for active filtered dataset (aggregated server-side across all matching rows)
  const stats = useMemo(() => {
    if (summary) {
      return {
        totalPaid: summary.total_revenue,
        paidCount: summary.paid_count,
        unpaidCount: summary.unpaid_count,
        cancelledCount: summary.cancelled_count,
        totalCount: summary.total_count,
        avgValue: summary.avg_ticket,
      }
    }
    if (!rows) return { totalPaid: 0, paidCount: 0, unpaidCount: 0, cancelledCount: 0, totalCount: 0, avgValue: 0 }
    let totalPaid = 0
    let paidCount = 0
    let unpaidCount = 0
    let cancelledCount = 0

    rows.forEach((b) => {
      if (b.status === 'PAID') {
        totalPaid += Number(b.net_payable || 0)
        paidCount++
      } else if (b.status === 'UNPAID') {
        unpaidCount++
      } else if (b.status === 'CANCELLED') {
        cancelledCount++
      }
    })

    const avgValue = paidCount > 0 ? Math.round(totalPaid / paidCount) : 0
    return { totalPaid, paidCount, unpaidCount, cancelledCount, totalCount: rows.length, avgValue }
  }, [summary, rows])

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let cnt = 0
    if (search.trim()) cnt++
    if (orderType) cnt++
    if (status) cnt++
    if (mode) cnt++
    if (period) cnt++
    if (dateFrom || dateTo) cnt++
    return cnt
  }, [search, orderType, status, mode, period, dateFrom, dateTo])

  if (rows === null) return <PageLoader label="Loading order history…" />

  return (
    <div className="w-full flex-1 flex flex-col space-y-4 pb-12">
      {/* ── 1. Top Header Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-md shadow-rose-500/25 shrink-0">
            <svg className="size-6 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order & Billing History
              </h1>
              <span className="rounded-full bg-rose-50 border border-rose-200 text-rose-700 px-3 py-0.5 text-xs font-black">
                {count.toLocaleString()} Total Bills
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              Live audit logs, customer invoices, payment settlements & tax registers
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow active:scale-95 transition-all duration-150 cursor-pointer"
            title="Download formatted Excel (.xlsx) file of currently filtered records"
          >
            <svg className="size-4 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI Metrics Strip (Updates dynamically with any filter) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Collected */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              {activeFiltersCount > 0 ? 'Filtered Revenue' : 'Total Revenue'}
            </span>
            <span className="size-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shadow-2xs">
              ₹
            </span>
          </div>
          <div className="mt-2.5">
            <p className="tabular text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">
              {money(stats.totalPaid)}
            </p>
            <p className="text-[11px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
              <span>⚡</span> {stats.paidCount.toLocaleString()} settled orders
            </p>
          </div>
        </div>

        {/* Total Filtered Orders */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Matching Records
            </span>
            <span className="size-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs shadow-2xs">
              🧾
            </span>
          </div>
          <div className="mt-2.5">
            <p className="tabular text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {stats.totalCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Page {page} of {Math.max(1, Math.ceil(stats.totalCount / 25))}
            </p>
          </div>
        </div>

        {/* Avg Bill Size */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Avg Ticket Value
            </span>
            <span className="size-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold shadow-2xs">
              📊
            </span>
          </div>
          <div className="mt-2.5">
            <p className="tabular text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ₹{stats.avgValue.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              per paid transaction
            </p>
          </div>
        </div>

        {/* Settlement Status Ratio */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Settlement Status
            </span>
            <span className="size-7 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xs font-bold shadow-2xs">
              🎯
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200">
              {stats.paidCount} Paid
            </span>
            {stats.unpaidCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-black border border-amber-200">
                {stats.unpaidCount} Open
              </span>
            )}
            {stats.cancelledCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 text-xs font-black border border-rose-200">
                {stats.cancelledCount} Void
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Modern Filter Hub ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
          {/* Left Side: Search + Order Type Segmented Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Search bar (Compact) */}
            <div className="relative w-full sm:w-64 md:w-72 shrink-0">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search Bill #, Name, Phone..."
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/90 hover:border-red-500 hover:bg-white focus:bg-white focus:border-red-600 py-2.5 pl-10 pr-9 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-red-500/20 hover:ring-2 hover:ring-red-500/20 transition-all shadow-2xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 size-5 flex items-center justify-center text-xs font-bold rounded-lg hover:bg-red-100 cursor-pointer"
                >
                  ✕
                </button>
              ) : (
                <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.2 rounded-md border border-slate-200 bg-white text-[10px] font-mono font-bold text-slate-400 select-none">
                  /
                </span>
              )}
            </div>

            {/* Segmented Toggle for Order Type with Smooth Red Slider */}
            <div className="relative inline-grid grid-cols-3 p-1 rounded-2xl bg-slate-100/90 border-2 border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto select-none min-w-[290px] sm:min-w-[310px]">
              {/* Smooth Animated Red Slider Pill */}
              <div
                className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 shadow-md shadow-rose-600/35 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  left: '4px',
                  transform: `translateX(${Math.max(0, ORDER_TYPES.findIndex((t) => t.value === orderType)) * 100}%)`,
                }}
              />

              {ORDER_TYPES.map((t) => {
                const active = orderType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setOrderType(t.value)
                      setPage(1)
                    }}
                    className={`relative z-10 px-3 py-1.5 text-xs font-black transition-colors duration-200 cursor-pointer text-center whitespace-nowrap active:scale-95 ${
                      active
                        ? 'text-white'
                        : 'text-slate-600 hover:text-red-600'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Side: Selectors Strip */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Period Preset Dropdown */}
            <ModernDropdown
              value={period}
              onChange={(val) => {
                setPeriod(val)
                setPage(1)
              }}
              options={PERIOD_PRESETS}
              placeholder="Date Range"
              width="w-52"
            />

            {/* Status Filter Dropdown */}
            <ModernDropdown
              value={status}
              onChange={(val) => {
                setStatus(val)
                setPage(1)
              }}
              options={STATUSES}
              placeholder="Status"
              width="w-44"
            />

            {/* Payment Mode Filter Dropdown */}
            <ModernDropdown
              value={mode}
              onChange={(val) => {
                setMode(val)
                setPage(1)
              }}
              options={ALL_PAYMENT_OPTIONS}
              placeholder="Payment"
              width="w-48"
            />

            {/* Reset All Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setOrderType('')
                  setStatus('')
                  setMode('')
                  setPeriod('')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-black text-red-600 hover:bg-red-50 border-2 border-red-300 hover:border-red-600 shadow-sm hover:shadow-md hover:ring-2 hover:ring-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Reset all filters"
              >
                <span>Reset</span>
                <span className="size-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Chip Bar (Appears when Custom Range is selected) */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>📅</span> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 border-2 border-slate-200 hover:border-red-500 hover:bg-red-50/40 rounded-xl px-2.5 py-1.5 shadow-2xs transition-all">
                <span className="text-[10px] uppercase font-black text-slate-400">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setPage(1)
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">→</span>
              <div className="flex items-center gap-1 bg-slate-50 border-2 border-slate-200 hover:border-red-500 hover:bg-red-50/40 rounded-xl px-2.5 py-1.5 shadow-2xs transition-all">
                <span className="text-[10px] uppercase font-black text-slate-400">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setPage(1)
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Tags Bar (Modern Pills) */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Active Filters:
            </span>
            {search.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                <span>Search: "{search.trim()}"</span>
                <button type="button" onClick={() => setSearch('')} className="hover:text-rose-600 font-black cursor-pointer">✕</button>
              </span>
            )}
            {orderType && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                <span>{ORDER_TYPES.find((t) => t.value === orderType)?.label || orderType}</span>
                <button type="button" onClick={() => setOrderType('')} className="hover:text-rose-900 font-black cursor-pointer">✕</button>
              </span>
            )}
            {period && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                <span>{PERIOD_PRESETS.find((p) => p.value === period)?.label || period}</span>
                <button type="button" onClick={() => { setPeriod(''); setDateFrom(''); setDateTo('') }} className="hover:text-sky-900 font-black cursor-pointer">✕</button>
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <span>Status: {STATUSES.find((s) => s.value === status)?.label || status}</span>
                <button type="button" onClick={() => setStatus('')} className="hover:text-amber-900 font-black cursor-pointer">✕</button>
              </span>
            )}
            {mode && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                <span>Payment: {PAYMENT_MODES.find((m) => m.value === mode)?.label || mode}</span>
                <button type="button" onClick={() => setMode('')} className="hover:text-indigo-900 font-black cursor-pointer">✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Redesigned Full-Width Orders Table ── */}
      {rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No billing records found"
          hint={
            search || status || mode || period
              ? 'No bills match your active search and filter criteria. Try resetting filters.'
              : 'Completed orders and settled bills will automatically appear here.'
          }
        />
      ) : (
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 font-black uppercase tracking-wider text-slate-400 text-[10px]">
                  <th className="px-5 sm:px-6 py-4">Bill # &amp; Date</th>
                  <th className="px-5 sm:px-6 py-4">Customer</th>
                  <th className="w-24 px-4 py-4 text-center">Items</th>
                  <th className="w-36 px-5 py-4 text-right">Net Amount</th>
                  <th className="w-36 px-5 py-4 text-center">Payment</th>
                  <th className="w-32 px-5 py-4 text-center">Status</th>
                  <th className="w-28 px-5 sm:px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rows.map((bill) => (
                  <tr
                    key={bill.id}
                    className={`group transition-all duration-150 hover:bg-slate-50/80 cursor-pointer ${
                      bill.status === 'CANCELLED' ? 'bg-slate-50/50 opacity-60' : ''
                    }`}
                    onClick={() => openBill(bill)}
                  >
                    {/* Bill # & Date */}
                    <td className="px-5 sm:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 tracking-tight group-hover:text-rose-600 transition-colors">
                          {bill.bill_number}
                        </span>
                        {bill.order_type === 'TAKEAWAY' ? (
                          <span className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.2 text-[9px] font-black uppercase text-rose-700">
                            Parcel
                          </span>
                        ) : (
                          <span className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-0.2 text-[9px] font-black uppercase text-slate-700">
                            Table {bill.table_number || bill.table || '—'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {dateTime(bill.created_at)}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="px-5 sm:px-6 py-4">
                      {bill.customer_name ? (
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span className="size-5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black flex items-center justify-center">
                              {bill.customer_name.charAt(0).toUpperCase()}
                            </span>
                            <span>{bill.customer_name}</span>
                          </div>
                          <div className="text-[10px] font-mono font-medium text-slate-400 mt-0.5 ml-6.5">
                            {bill.customer_phone}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-300">Walk-in Guest</span>
                      )}
                    </td>

                    {/* Items count */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex h-6 px-2.5 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700 tabular">
                        {bill.item_count || bill.items?.length || 1}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 text-right">
                      <div className="text-sm sm:text-base font-black text-slate-900 tabular">
                        {money(bill.net_payable)}
                      </div>
                      {Number(bill.discount_amount) > 0 && (
                        <div className="text-[10px] font-bold text-emerald-600">
                          -₹{Number(bill.discount_amount).toFixed(2)} off
                        </div>
                      )}
                    </td>

                    {/* Payment Mode */}
                    <td className="px-5 py-4 text-center">
                      {bill.payment_mode ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-[11px] font-bold text-slate-700">
                          <span>{bill.payment_mode_display || bill.payment_mode}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center">
                      <Badge tone={BILL_STATUS_TONE[bill.status] || 'gray'}>
                        {bill.status_display || bill.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 sm:px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openBill(bill)}
                          title="Print Thermal Receipt"
                          className="size-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs"
                        >
                          🖨️
                        </button>
                        {bill.status !== 'CANCELLED' && isOwner && (
                          <button
                            type="button"
                            onClick={() => setCancelling(bill)}
                            title="Cancel / Void Bill"
                            className="size-8 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-700 flex items-center justify-center text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Controls ── */}
          {count > 25 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex-wrap gap-3">
              <span className="text-xs font-semibold text-slate-500">
                Showing <strong className="text-slate-900">{(page - 1) * 25 + 1}</strong> to{' '}
                <strong className="text-slate-900">{Math.min(page * 25, count)}</strong> of{' '}
                <strong className="text-slate-900">{count.toLocaleString()}</strong> bills
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs font-black text-slate-900 px-2">
                  Page {page} of {Math.ceil(count / 25)}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(count / 25)}
                  onClick={() => setPage(page + 1)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {viewing && (
        <PrintSlipModal
          title={`Bill #${viewing.bill_number}`}
          subtitle={`Table ${viewing.table_number || 'Takeaway'} · ${viewing.status_display}`}
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
    </div>
  )
}
