import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { categories as categoryApi, items as itemApi } from '@/services/menu'
import { tables as tableApi } from '@/services/tables'
import { reportsService } from '@/services/reports'
import { money } from '@/utils/format'
import { PageLoader } from '@/components/ui/Misc'
import {
  IconPos,
  IconTables,
  IconReceipt,
  IconChefHat,
} from '@/components/ui/Icons'

export default function Dashboard() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [tableStats, setTableStats] = useState({ available: 0, occupied: 0, total: 0, billed: 0, occupancyPercent: 0 })
  const [salesSummary, setSalesSummary] = useState({ todaySales: 0, totalBills: 0, avgBill: 0, trend: 'Live' })
  const [kitchenSpeed, setKitchenSpeed] = useState('12 mins')
  const [hourlyCurve, setHourlyCurve] = useState([])
  const [paymentBreakdown, setPaymentBreakdown] = useState({ upi_pct: 0, upi_amount: '0', card_pct: 0, card_amount: '0', cash_pct: 0, cash_amount: '0' })
  const [dineinPercent, setDineinPercent] = useState(0)
  const [timeFilter, setTimeFilter] = useState('today')
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [bellRinging, setBellRinging] = useState(false)

  // Sliding pill indicator smooth glide transition
  const containerRef = useRef(null)
  const buttonsRef = useRef({})
  const [gliderStyle, setGliderStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updateGlider = () => {
    const activeBtn = buttonsRef.current[timeFilter]
    const container = containerRef.current
    if (activeBtn && container) {
      const containerRect = container.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      if (btnRect.width > 0) {
        setGliderStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
          opacity: 1,
        })
      }
    }
  }

  useLayoutEffect(() => {
    updateGlider()
  }, [timeFilter, stats])

  useEffect(() => {
    const frame = requestAnimationFrame(updateGlider)
    return () => cancelAnimationFrame(frame)
  }, [timeFilter, stats])

  useEffect(() => {
    const handleResize = () => updateGlider()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [timeFilter])

  // Keyboard F2 Shortcut for POS Terminal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        navigate('/pos')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleBellClick = () => {
    setBellRinging(true)
    setTimeout(() => setBellRinging(false), 700)
  }

  const summaryCache = useRef({})
  const tablesRef = useRef([])

  const applySummary = (summary, tbls = tablesRef.current) => {
    if (!summary) return
    setSalesSummary({
      todaySales: Number(summary.today_sales || 0),
      totalBills: summary.total_bills || 0,
      avgBill: Number(summary.avg_ticket || 0),
      trend: summary.sales_trend || 'Live',
    })
    if (summary.table_stats) {
      setTableStats({
        total: summary.table_stats.total || tbls.length,
        occupied: summary.table_stats.occupied || 0,
        billed: summary.table_stats.billed || 0,
        available: summary.table_stats.available || 0,
        occupancyPercent: summary.table_stats.occupancy_percent || 0,
      })
    }
    setKitchenSpeed(summary.kitchen_speed || '12 mins')
    setHourlyCurve(summary.hourly_curve || [])
    setPaymentBreakdown(
      summary.payment_breakdown || { upi_pct: 0, upi_amount: '0', card_pct: 0, card_amount: '0', cash_pct: 0, cash_amount: '0' }
    )
    setDineinPercent(summary.dinein_percent || 0)
  }

  // Handle instant smooth time filter change
  const handleTimeFilterSelect = (newFilter) => {
    setTimeFilter(newFilter)
    if (summaryCache.current[newFilter]) {
      // 0ms instant transition from cache
      applySummary(summaryCache.current[newFilter])
    }
    // Background revalidate to ensure freshest live numbers
    reportsService
      .getDashboardSummary(newFilter)
      .then((summary) => {
        if (summary) {
          summaryCache.current[newFilter] = summary
          applySummary(summary)
        }
      })
      .catch(() => {})
  }

  // Initial load
  useEffect(() => {
    Promise.all([
      categoryApi.list().catch(() => []),
      itemApi.list().catch(() => []),
      tableApi.list().catch(() => []),
      reportsService.getDashboardSummary('today').catch(() => null),
    ])
      .then(([cats, items, tbls, todaySummary]) => {
        tablesRef.current = tbls
        setStats({
          categories: cats.length,
          items: items.length,
          outOfStock: items.filter((i) => !i.is_available).length,
          veg: items.filter((i) => i.food_type === 'VEG').length,
          outOfStockList: items.filter((i) => !i.is_available).slice(0, 3),
        })

        if (todaySummary) {
          summaryCache.current['today'] = todaySummary
          applySummary(todaySummary, tbls)
        } else {
          const occupied = tbls.filter((t) => t.is_occupied || t.status === 'OCCUPIED').length
          const billed = tbls.filter((t) => t.status === 'BILLED').length
          const available = Math.max(0, tbls.length - occupied - billed)
          const occupancyPercent = tbls.length > 0 ? Math.round(((occupied + billed) / tbls.length) * 100) : 0
          setTableStats({ total: tbls.length, occupied, billed, available, occupancyPercent })
        }

        // Prefetch 'week' and 'month' in background so switching is instant
        reportsService
          .getDashboardSummary('week')
          .then((weekSum) => {
            if (weekSum) summaryCache.current['week'] = weekSum
          })
          .catch(() => {})

        reportsService
          .getDashboardSummary('month')
          .then((monthSum) => {
            if (monthSum) summaryCache.current['month'] = monthSum
          })
          .catch(() => {})
      })
      .catch(() => {
        setStats({ categories: 0, items: 0, outOfStock: 0, veg: 0, outOfStockList: [] })
      })
  }, [])

  // Auto-refresh active filter every 15s in background
  useEffect(() => {
    const id = setInterval(() => {
      reportsService
        .getDashboardSummary(timeFilter)
        .then((summary) => {
          if (summary) {
            summaryCache.current[timeFilter] = summary
            applySummary(summary)
          }
        })
        .catch(() => {})
    }, 15000)
    return () => clearInterval(id)
  }, [timeFilter])

  if (!stats) return <PageLoader label="Loading Executive Dashboard…" />

  return (
    <div className="w-full space-y-5">
      {/* BEGIN: Executive Command Center Header Bar */}
      <section
        className="w-full bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.06),0_2px_8px_-2px_rgba(15,23,42,0.03)] p-2.5 sm:p-3.5 transition-all duration-300 hover:shadow-[0_16px_45px_-8px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)]"
        data-purpose="executive-header-bar"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left Section: Cloche Icon + Title Badge */}
          <div className="flex items-center gap-3.5 w-full lg:w-auto pl-1 sm:pl-2">
            {/* Icon Squircle with Live Emerald Beacon */}
            <div className="relative flex-shrink-0">
              <div
                className="w-12 h-12 rounded-2xl bg-rose-50/80 flex items-center justify-center text-rose-600 transition-transform duration-200 hover:scale-105"
                title="Restaurant Command Service Active"
              >
                {/* Cloche / Restaurant Dome Icon */}
                <svg className="w-6 h-6 stroke-current fill-none stroke-[2] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                  <circle className="fill-current stroke-none" cx="12" cy="7" r="1" />
                  <path d="M4 15a8 8 0 0 1 16 0H4z" />
                  <path className="fill-current opacity-90 stroke-none" d="M5 18h14l-1 2H6l-1-2z" />
                  <line x1="3" x2="21" y1="18" y2="18" />
                </svg>
              </div>
              {/* Animated Emerald Status Beacon */}
              <span className="absolute -top-1 -right-1 flex h-4 w-4" title="Telemetry Live Connected">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
              </span>
            </div>

            {/* Title & Status Subline */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
                  Executive Command Center
                </h2>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 hidden sm:block">
                {user?.full_name || user?.username || 'Admin'} ({user?.custom_role?.name || user?.role_display || user?.role || 'Owner'}) <span className="text-slate-300">•</span> Real-time outlet metrics
              </p>
            </div>
          </div>
          {/* END Left Section */}

          {/* Center-Right Controls: Time Range Segmented Switcher + Notification Bell */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-3 w-full lg:w-auto">
            {/* Segmented Pill Time Filter with Smooth Gliding Indicator */}
            <div
              ref={containerRef}
              className="relative flex items-center p-1 bg-slate-50/90 rounded-full border border-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
              data-purpose="segmented-time-filter"
            >
              {/* Sliding Red Background Indicator */}
              <div
                aria-hidden="true"
                style={{
                  transform: `translateX(${gliderStyle.left}px)`,
                  width: `${gliderStyle.width}px`,
                  opacity: gliderStyle.opacity,
                }}
                className="pill-glider absolute left-0 top-1 bottom-1 bg-rose-600 rounded-full shadow-[0_4px_14px_-2px_rgba(225,29,72,0.4)] pointer-events-none"
              />

              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
              ].map((pill) => {
                const isActive = timeFilter === pill.id
                return (
                  <button
                    key={pill.id}
                    ref={(el) => (buttonsRef.current[pill.id] = el)}
                    type="button"
                    onClick={() => handleTimeFilterSelect(pill.id)}
                    className={`time-pill-btn relative z-10 px-3.5 sm:px-4 py-1.5 rounded-full text-xs transition-colors duration-200 select-none cursor-pointer ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>

            {/* Notification Bell Icon Button */}
            <div className="relative">
              <button
                type="button"
                onClick={handleBellClick}
                aria-label="View notifications (1 unread)"
                className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 shadow-xs relative group focus:outline-none cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 stroke-current fill-none stroke-[2] stroke-linecap-round stroke-linejoin-round transition-transform group-hover:scale-110 ${
                    bellRinging ? 'animate-bell-ring' : ''
                  }`}
                  viewBox="0 0 24 24"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {/* Crimson Indicator Pip */}
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white" />
              </button>
            </div>
          </div>
          {/* END Center-Right Controls */}
        </div>
      </section>
      {/* END: Executive Command Center Header Bar */}

      {/* Out-of-Stock Alert Strip */}
      {stats.outOfStock > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-2.5 text-xs font-bold text-rose-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-rose-600 animate-ping" />
            <span>
              ⚠️ <strong>{stats.outOfStock} items currently disabled:</strong>{' '}
              {stats.outOfStockList.map((i) => i.name).join(', ')}
            </span>
          </div>
          <Link to="/menu" className="font-black text-rose-700 underline hover:text-rose-900">
            Manage Menu →
          </Link>
        </div>
      )}

      {/* Row 1: Proportional Compact KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<IconReceipt className="size-5 text-rose-600" />}
          label={timeFilter === 'today' ? 'Today Sales' : timeFilter === 'week' ? 'This Week Sales' : 'This Month Sales'}
          value={money(salesSummary.todaySales)}
          sub={`${salesSummary.totalBills} Paid Orders`}
          trend={salesSummary.trend}
        />
        <KpiCard
          icon={<IconTables className="size-5 text-emerald-600" />}
          label="Table Occupancy"
          value={`${tableStats.occupancyPercent}%`}
          sub={`${tableStats.occupied + tableStats.billed}/${tableStats.total} Tables Occupied`}
          trend={`${tableStats.available} Free Tables`}
        />
        <KpiCard
          icon={<IconPos className="size-5 text-amber-600" />}
          label="Avg Ticket Size"
          value={money(salesSummary.avgBill)}
          sub="Per Customer Bill"
          trend="Real Average"
        />
        <KpiCard
          icon={<IconChefHat className="size-5 text-slate-700" />}
          label="Kitchen Speed"
          value={kitchenSpeed}
          sub="Average KOT Prep"
          trend="Order Turnaround"
        />
      </div>

      {/* Row 2: Smooth SVG Gradient Area Chart & Payment Breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* World-Class Smooth SVG Area Line Chart */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900">Peak Hours Revenue Curve</h2>
              <p className="text-[11px] text-slate-400 font-semibold">Continuous sales intensity graph (10 AM - 10 PM)</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-extrabold">
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="size-2.5 rounded-full bg-rose-600" />
                Dinner Peak (7-9 PM)
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="size-2.5 rounded-full bg-amber-500" />
                Lunch Peak (12-2 PM)
              </span>
            </div>
          </div>

          {/* SVG Area Chart Container */}
          <div className="relative pt-2">
            <SvgAreaChart
              data={hourlyCurve}
              hoveredPoint={hoveredPoint}
              onHover={setHoveredPoint}
            />
          </div>
        </div>

        {/* Payment Channels Breakdown */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900">Payment Modes Share</h2>
            <p className="text-[11px] text-slate-400 font-semibold">Revenue channel breakdown</p>
          </div>

          <div className="space-y-3">
            <PaymentShareRow label="UPI / QR Code" percent={paymentBreakdown.upi_pct} color="bg-emerald-500" amount={`${paymentBreakdown.upi_pct}% (₹${paymentBreakdown.upi_amount})`} />
            <PaymentShareRow label="Credit / Debit Card" percent={paymentBreakdown.card_pct} color="bg-rose-500" amount={`${paymentBreakdown.card_pct}% (₹${paymentBreakdown.card_amount})`} />
            <PaymentShareRow label="Cash Payment" percent={paymentBreakdown.cash_pct} color="bg-amber-500" amount={`${paymentBreakdown.cash_pct}% (₹${paymentBreakdown.cash_amount})`} />
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200/60 p-3 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Dine-In vs Takeaway</span>
            <span className="text-rose-600 font-black">{dineinPercent}% Dine-In</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SvgAreaChart({ data, hoveredPoint, onHover }) {
  const width = 600
  const height = 180
  const paddingX = 40
  const paddingY = 25

  if (!data || data.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-xs font-semibold text-slate-400">
        No hourly sales data recorded yet.
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1000)
  const maxVal = Math.ceil(maxRevenue / 1000) * 1000 || 5000

  const points = data.map((d, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * (width - 2 * paddingX)
    const y = height - paddingY - (d.revenue / maxVal) * (height - 2 * paddingY)
    return { ...d, x, y }
  })

  // Build SVG Path string with smooth cubic bezier curve
  let dPath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cp1x = curr.x + (next.x - curr.x) / 2
    const cp1y = curr.y
    const cp2x = curr.x + (next.x - curr.x) / 2
    const cp2y = next.y
    dPath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
  }

  // Area path for gradient fill
  const areaPath = `${dPath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`

  return (
    <div className="relative w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e11d48" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Dotted Gridlines */}
        {[0.25, 0.5, 0.75, 1].map((factor) => {
          const val = maxVal * factor
          const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY)
          return (
            <g key={factor}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x={paddingX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">
                ₹{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          )
        })}

        {/* Smooth Gradient Area Fill */}
        <path d={areaPath} fill="url(#roseGradient)" />

        {/* Smooth Curved Line */}
        <path d={dPath} fill="none" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" />

        {/* Interactive Point Markers */}
        {points.map((pt, idx) => {
          const isHovered = hoveredPoint === idx
          const isPeak = pt.peak === 'DINNER' || pt.peak === 'LUNCH'
          return (
            <g
              key={pt.hour}
              className="cursor-pointer group"
              onMouseEnter={() => onHover(idx)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Outer Pulse Circle for Peaks */}
              {isPeak && pt.revenue > 0 && (
                <circle cx={pt.x} cy={pt.y} r="8" fill="#e11d48" opacity="0.2" className="animate-ping" />
              )}

              {/* Data Dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? "6" : isPeak ? "5" : "4"}
                fill={isPeak ? "#e11d48" : "#f59e0b"}
                stroke="#ffffff"
                strokeWidth="2.5"
                className="transition-all duration-150 shadow-xs"
              />

              {/* Value Label above Dot */}
              <text
                x={pt.x}
                y={pt.y - 10}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={isPeak ? "#be123c" : "#0f172a"}
              >
                {pt.label}
              </text>

              {/* Time Label on X Axis */}
              <text
                x={pt.x}
                y={height - 5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#64748b"
              >
                {pt.hour}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover Active Card */}
      {hoveredPoint !== null && points[hoveredPoint] && (
        <div className="absolute top-2 right-4 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-bold shadow-md animate-fade-in">
          <span>{points[hoveredPoint].hour}: </span>
          <span className="text-amber-400 font-black tabular">{points[hoveredPoint].label} Sales</span>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, trend }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
          {icon}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600 border border-slate-200/70">
          {sub}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="tabular mt-0.5 text-xl font-black text-slate-900 tracking-tight">{value}</p>
        <p className="mt-0.5 text-[10px] font-extrabold text-emerald-700">↑ {trend}</p>
      </div>
    </div>
  )
}

function PaymentShareRow({ label, percent, color, amount }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-extrabold text-slate-700">
        <span>{label}</span>
        <span className="tabular font-black">{amount}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
