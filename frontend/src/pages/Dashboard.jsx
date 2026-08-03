import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { categories as categoryApi, items as itemApi } from '@/services/menu'
import { tables as tableApi } from '@/services/tables'
import { reportsService } from '@/services/reports'
import { ROLE_LABEL } from '@/utils/roles'
import { money } from '@/utils/format'
import { PageLoader } from '@/components/ui/Misc'
import {
  IconPos,
  IconTables,
  IconSparkles,
  IconReceipt,
  IconChefHat,
} from '@/components/ui/Icons'

export default function Dashboard() {
  const { user, role } = useAuth()
  const [stats, setStats] = useState(null)
  const [tableStats, setTableStats] = useState({ available: 0, occupied: 0, total: 0, billed: 0, occupancyPercent: 0 })
  const [salesSummary, setSalesSummary] = useState({ todaySales: 0, totalBills: 0, avgBill: 0, trend: 'Live' })
  const [kitchenSpeed, setKitchenSpeed] = useState('12 mins')
  const [hourlyCurve, setHourlyCurve] = useState([])
  const [paymentBreakdown, setPaymentBreakdown] = useState({ upi_pct: 0, upi_amount: '0', card_pct: 0, card_amount: '0', cash_pct: 0, cash_amount: '0' })
  const [dineinPercent, setDineinPercent] = useState(0)
  const [topDishes, setTopDishes] = useState([])
  const [timeFilter, setTimeFilter] = useState('today')
  const [hoveredPoint, setHoveredPoint] = useState(null)

  useEffect(() => {
    Promise.all([
      categoryApi.list().catch(() => []),
      itemApi.list().catch(() => []),
      tableApi.list().catch(() => []),
      reportsService.getDashboardSummary(timeFilter).catch(() => null),
    ])
      .then(([cats, items, tbls, summary]) => {
        setStats({
          categories: cats.length,
          items: items.length,
          outOfStock: items.filter((i) => !i.is_available).length,
          veg: items.filter((i) => i.food_type === 'VEG').length,
          outOfStockList: items.filter((i) => !i.is_available).slice(0, 3),
        })

        if (summary) {
          setSalesSummary({
            todaySales: Number(summary.today_sales || 0),
            totalBills: summary.total_bills || 0,
            avgBill: Number(summary.avg_ticket || 0),
            trend: summary.sales_trend || 'Live',
          })
          setTableStats({
            total: summary.table_stats.total || tbls.length,
            occupied: summary.table_stats.occupied || 0,
            billed: summary.table_stats.billed || 0,
            available: summary.table_stats.available || 0,
            occupancyPercent: summary.table_stats.occupancy_percent || 0,
          })
          setKitchenSpeed(summary.kitchen_speed || '12 mins')
          setHourlyCurve(summary.hourly_curve || [])
          setPaymentBreakdown(summary.payment_breakdown || { upi_pct: 0, upi_amount: '0', card_pct: 0, card_amount: '0', cash_pct: 0, cash_amount: '0' })
          setDineinPercent(summary.dinein_percent || 0)
          setTopDishes(summary.top_dishes || [])
        } else {
          const occupied = tbls.filter((t) => t.is_occupied || t.status === 'OCCUPIED').length
          const billed = tbls.filter((t) => t.status === 'BILLED').length
          const available = Math.max(0, tbls.length - occupied - billed)
          const occupancyPercent = tbls.length > 0 ? Math.round(((occupied + billed) / tbls.length) * 100) : 0
          setTableStats({ total: tbls.length, occupied, billed, available, occupancyPercent })
        }
      })
      .catch(() => {
        setStats({ categories: 0, items: 0, outOfStock: 0, veg: 0, outOfStockList: [] })
      })
  }, [timeFilter])

  if (!stats) return <PageLoader label="Loading Executive Dashboard…" />

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600">
            <IconChefHat className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Command Center</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400">
              {user?.full_name || user?.username} ({ROLE_LABEL[role]}) · Real-time outlet metrics
            </p>
          </div>
        </div>

        {/* Date Filter & CTA */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 shadow-2xs">
            {['today', 'week', 'month'].map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-all ${
                  timeFilter === t
                    ? 'bg-rose-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          <Link
            to="/pos"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-600/20 active:scale-95 transition-all"
          >
            <IconPos className="size-4 text-white" />
            POS Terminal
          </Link>
        </div>
      </div>

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

      {/* Row 3: Top Bestselling Dishes Leaderboard */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <IconSparkles className="size-4 text-rose-600" />
              Top Bestselling Dishes Leaderboard
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold">Highest performing dishes by revenue &amp; order volume</p>
          </div>
          <Link to="/menu" className="text-xs font-black text-rose-600 hover:underline">
            View All Dishes →
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {topDishes.map((item, idx) => (
            <div
              key={item.name + idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3 transition-all hover:bg-white hover:border-rose-300 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex size-5 items-center justify-center rounded-md bg-rose-100 text-[10px] font-black text-rose-700">
                    #{idx + 1}
                  </span>
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {item.total_qty > 0 ? `${item.total_qty} Sold` : 'Available'}
                  </span>
                </div>
                <p className="text-xs font-extrabold text-slate-900 truncate">{item.name}</p>
                <p className="text-[10px] font-semibold text-slate-400">{item.portion ? `Portion: ${item.portion}` : item.category_name || 'Main'}</p>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-xs font-black text-slate-900">
                <span>Revenue</span>
                <span className="tabular">{item.total_revenue && item.total_revenue !== '0.00' ? money(item.total_revenue) : money(item.price || 0)}</span>
              </div>
            </div>
          ))}
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
