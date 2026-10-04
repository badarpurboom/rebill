import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { tables as tableApi, TABLE_STATUS } from '@/services/tables'
import { orders as orderApi, restaurantSettings } from '@/services/billing'
import { getCache, setCache } from '@/services/db'
import { money } from '@/utils/format'
import Button from '@/components/ui/Button'
import { EmptyState, PageLoader } from '@/components/ui/Misc'
import FloorMap from '@/components/tables/FloorMap'
import TableFormModal from '@/components/tables/TableFormModal'
import TransferModal from '@/components/tables/TransferModal'
import VoidOrderModal from '@/components/tables/VoidOrderModal'
import PaymentModal from '@/components/pos/PaymentModal'
import QuickCustomerModal from '@/components/customers/QuickCustomerModal'
import TakeawayNameModal from '@/components/pos/TakeawayNameModal'

/* ─── Page ────────────────────────────────────────────────────────── */
export default function Tables() {
  const { isOwner } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [settings, setSettings] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formTable, setFormTable] = useState(null)
  const [payingOrder, setPayingOrder] = useState(null)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [takeaways, setTakeaways] = useState([])
  const [startingTakeaway, setStartingTakeaway] = useState(false)
  const [transferringTable, setTransferringTable] = useState(null)
  const [voidingTable, setVoidingTable] = useState(null)

  /* Load */
  const load = useCallback(async () => {
    try {
      const [tableList, openOrders] = await Promise.all([
        tableApi.list(),
        orderApi.listOpen().catch(() => []),
      ])
      setRows(tableList)
      setTakeaways((openOrders || []).filter((o) => o.order_type === 'TAKEAWAY' && o.has_kots))
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load floor map.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getCache('restaurant_settings').then((c) => {
      if (c) setSettings(c)
    })
    restaurantSettings
      .get()
      .then((data) => {
        setSettings(data)
        setCache('restaurant_settings', data)
      })
      .catch(() => {})
  }, [])

  /* Auto-refresh */
  useEffect(() => {
    if (editing) return
    const id = setInterval(() => {
      tableApi.list().then(setRows).catch(() => {})
      orderApi.listOpen().then((openOrders) => {
        setTakeaways((openOrders || []).filter((o) => o.order_type === 'TAKEAWAY' && o.has_kots))
      }).catch(() => {})
    }, 15_000)
    return () => clearInterval(id)
  }, [editing])

  /* Derived */
  const summary = useMemo(() => {
    const c = { AVAILABLE: 0, OCCUPIED: 0, BILLED: 0 }
    for (const t of rows) c[t.status] = (c[t.status] ?? 0) + 1
    return c
  }, [rows])

  /* Layout drag */
  const moveTable = (id, pos_x, pos_y) => {
    setRows((cur) => cur.map((t) => (t.id === id ? { ...t, pos_x, pos_y } : t)))
    setDirty(true)
  }

  const saveLayout = async () => {
    setSaving(true)
    try {
      await tableApi.saveLayout(rows.map(({ id, pos_x, pos_y }) => ({ id, pos_x, pos_y })))
      setDirty(false)
      setEditing(false)
      toast.success('Floor layout saved!')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save layout.'))
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = async () => {
    if (dirty && !window.confirm('Unsaved layout changes will be lost. Continue?')) return
    setEditing(false)
    setDirty(false)
    await load()
  }

  /* Open table in POS */
  const openTable = (table) => {
    if (!table.is_active) { toast.info(`Table ${table.number} is inactive.`); return }
    navigate(`/pos?table=${table.id}`)
  }

  const [takeawayNameModalOpen, setTakeawayNameModalOpen] = useState(false)

  /* Start new Takeaway order */
  const handleStartTakeaway = () => {
    setTakeawayNameModalOpen(true)
  }

  const handleConfirmTakeawayName = async (tagName) => {
    setTakeawayNameModalOpen(false)
    setStartingTakeaway(true)
    try {
      const order = await orderApi.createTakeaway(tagName)
      navigate(`/pos?order=${order.id}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to start takeaway.'))
    } finally {
      setStartingTakeaway(false)
    }
  }

  /* Handle Pay Bill click from table */
  const handlePayClick = async (e, table) => {
    e.preventDefault()
    e.stopPropagation()
    if (!table.open_order_id) {
      toast.error('No open order found for this table.')
      return
    }
    setLoading(true)
    try {
      const order = await orderApi.get(table.open_order_id)
      const isMandatory = Boolean(settings?.customer_details_mandatory)
      const hasCustomer = Boolean(order.customer || order.customer_detail)
      if (isMandatory && !hasCustomer) {
        setPendingOrder(order)
        setQuickCustomerOpen(true)
      } else if (!hasCustomer) {
        setPendingOrder(order)
        setQuickCustomerOpen(true)
      } else {
        setPayingOrder(order)
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to fetch order.'))
    } finally {
      setLoading(false)
    }
  }

  const handleTransferClick = (e, table) => {
    e.preventDefault()
    e.stopPropagation()
    setTransferringTable(table)
  }

  const handleTransferSubmit = async (sourceId, targetId) => {
    try {
      const res = await tableApi.transfer(sourceId, targetId)
      toast.success(res?.detail ?? 'Table transferred successfully!')
      setTransferringTable(null)
      await load() // Refresh tables before closing so UI is fresh
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to transfer table.'))
      // Refresh even on error — the target table may have changed status
      load()
    }
  }

  const handleVoidClick = (e, table) => {
    e.preventDefault()
    e.stopPropagation()
    if (!table.open_order_id) {
      toast.error(`Table ${table.number} has no active order.`)
      return
    }
    setVoidingTable(table)
  }

  const handleVoidConfirm = async (table) => {
    try {
      await orderApi.void(table.open_order_id)
      toast.success(`Table ${table.number} order cancelled and table is now available.`)
      setVoidingTable(null)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to cancel order.'))
    }
  }

  const handleQuickCustomerSave = async (savedCustomer) => {
    try {
      setLoading(true)
      const updatedOrder = await orderApi.setCustomer(pendingOrder.id, savedCustomer.id)
      setQuickCustomerOpen(false)
      setPayingOrder(updatedOrder)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to attach customer.'))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickCustomerSkip = () => {
    if (settings?.customer_details_mandatory) {
      toast.error('Customer details are mandatory before settling the bill.')
      return
    }
    setQuickCustomerOpen(false)
    setPayingOrder(pendingOrder)
  }

  const handlePayTakeaway = async (tk) => {
    setLoading(true)
    try {
      const order = await orderApi.get(tk.id)
      const isMandatory = Boolean(settings?.customer_details_mandatory)
      const hasCustomer = Boolean(order.customer || order.customer_detail)
      if (isMandatory && !hasCustomer) {
        setPendingOrder(order)
        setQuickCustomerOpen(true)
      } else if (!hasCustomer) {
        setPendingOrder(order)
        setQuickCustomerOpen(true)
      } else {
        setPayingOrder(order)
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to open payment for takeaway.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVoidTakeaway = async (tk) => {
    if (!window.confirm(`Are you sure you want to cancel Takeaway #${tk.id}?`)) return
    try {
      await orderApi.void(tk.id)
      toast.success(`Takeaway #${tk.id} cancelled.`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to cancel takeaway.'))
    }
  }

  if (loading) return <PageLoader label="Loading floor map…" />

  return (
    <div className="space-y-5">

      {/* ── Luxury Status Bar Header Card ── */}
      <section
        aria-label="Main Dining Room Live Status & Quick Action Bar"
        className="luxury-panel w-full rounded-2xl md:rounded-3xl p-5 sm:p-6 md:px-8 md:py-6 border border-slate-200/80"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-4">
          {/* Left Section: Header Title and Real-Time Dining Indicators */}
          <div className="space-y-3.5">
            {/* Primary Title */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans leading-none">
                Main Dining Room
              </h1>
            </div>

            {/* Bottom Telemetry Chips Row: Available, Occupied, Billed */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm font-medium" data-purpose="occupancy-telemetry">
              {/* Indicator: Available (Green Dot) */}
              <div
                className="group inline-flex items-center gap-2 cursor-default transition-transform duration-200 hover:scale-105"
                title={`${summary.AVAILABLE ?? 0} tables ready for seating`}
              >
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 group-hover:scale-150 transition-all duration-300"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-emerald-100"></span>
                </span>
                <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                  Available <strong className="font-bold text-slate-900 ml-0.5">{summary.AVAILABLE ?? 0}</strong>
                </span>
              </div>

              {/* Indicator: Occupied (Crimson Red Pulsing Dot) */}
              <div
                className="group inline-flex items-center gap-2 cursor-default transition-transform duration-200 hover:scale-105"
                title={`${summary.OCCUPIED ?? 0} tables currently occupied`}
              >
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  {/* Outer glowing breathing radar ping */}
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose-600 animate-radar-wave"></span>
                  {/* Core vibrant red dot */}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 ring-2 ring-rose-100 shadow-[0_0_8px_rgba(225,29,72,0.6)]"></span>
                </span>
                <span className="text-slate-600 font-medium group-hover:text-rose-700 transition-colors">
                  Occupied <strong className="font-bold text-rose-600 ml-0.5">{summary.OCCUPIED ?? 0}</strong>
                </span>
              </div>

              {/* Indicator: Billed (Amber Dot) */}
              <div
                className="group inline-flex items-center gap-2 cursor-default transition-transform duration-200 hover:scale-105"
                title={`${summary.BILLED ?? 0} tables currently settling bills`}
              >
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 ring-2 ring-amber-100"></span>
                </span>
                <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                  Billed <strong className="font-bold text-slate-900 ml-0.5">{summary.BILLED ?? 0}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Section: Action Button "Takeaway Order" */}
          <div className="flex items-center self-start sm:self-auto pt-1 md:pt-0">
            <button
              onClick={handleStartTakeaway}
              disabled={startingTakeaway}
              className="shimmer-btn group relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold tracking-tight text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 shadow-lg shadow-slate-950/15 hover:shadow-xl hover:shadow-rose-600/25 active:scale-[0.97] transition-all duration-300 disabled:opacity-60 cursor-pointer"
              type="button"
            >
              {/* Glowing Red Ambient Hover Layer */}
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-600 to-rose-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0"></span>
              {/* Bag Icon */}
              <svg
                aria-hidden="true"
                className="relative z-10 w-4 h-4 text-rose-400 group-hover:text-white transition-colors duration-300 transform group-hover:-translate-y-0.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                <path d="M3 6h18"></path>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              {/* Text Label */}
              <span className="relative z-10 font-semibold tracking-normal text-white">
                {startingTakeaway ? 'Starting...' : 'Takeaway Order'}
              </span>
              {/* Subtle Keycap Badge */}
              <span className="relative z-10 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-white/10 group-hover:bg-white/20 text-white/90 transition-colors">
                +N
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Active Takeaway Bags: Compact Boutique Die-Cut Carry Bag KPI Cards ── */}
      {takeaways.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {takeaways.map((tk) => (
            <div key={tk.id} className="relative w-full group/card">
              {/* Ambient Glow Behind Card */}
              <div className="absolute -inset-1 bg-rose-500/10 rounded-[22px] blur-lg pointer-events-none transition-all duration-500 group-hover/card:bg-rose-500/20 group-hover/card:blur-xl" />

              {/* Main Bag Container */}
              <div className="boutique-card relative bg-[#131317] border border-[#23232c] rounded-2xl overflow-hidden shadow-[0_12px_30px_-8px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(225,29,72,0.22)] hover:border-rose-500/40 flex flex-col justify-between">
                {/* Top Crimp Fold & Flap Section */}
                <div className="pt-2 pb-2 bg-gradient-to-b from-[#1c1c22] to-[#151519] border-b border-zinc-800/80">
                  <div className="crimp-seal -mt-2 mb-1.5 opacity-70" />
                  {/* Integrated Die-Cut Oval Handle with Breathing Glow */}
                  <div className="die-cut-handle animate-glow-pulse border border-rose-500/70" />
                </div>

                {/* Card Inner Body */}
                <div className="px-3.5 pt-2 pb-3">
                  {/* Status Indicator Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[9px] font-mono font-medium text-rose-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                      </span>
                      <span className="tracking-wider uppercase font-semibold">ACTIVE</span>
                    </div>

                    <span className="inline-flex items-center text-[10px] font-mono font-bold tracking-wider text-zinc-100 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase">
                      #TK-{tk.id}
                    </span>
                  </div>


                  {/* Metric Display */}
                  <div
                    onClick={() => navigate(`/pos?order=${tk.id}`)}
                    className="flex items-center justify-center py-1 mb-2.5 cursor-pointer"
                  >
                    <div className="text-[24px] sm:text-[26px] leading-tight font-extrabold text-white tracking-tight font-mono text-center drop-shadow-sm select-none">
                      ₹{Number(tk.subtotal || tk.net_payable || tk.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  {/* Action Buttons Container */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-zinc-800/70">
                    {/* Cancel Order */}
                    <button
                      onClick={() => handleVoidTakeaway(tk)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-zinc-900/90 hover:bg-rose-950/40 border border-zinc-700/60 hover:border-rose-500/60 text-zinc-300 hover:text-rose-200 text-[10px] font-semibold tracking-tight transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
                      type="button"
                    >
                      <svg className="size-3 text-current" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Cancel</span>
                    </button>

                    {/* Pay Bill */}
                    <button
                      onClick={() => handlePayTakeaway(tk)}
                      className="relative overflow-hidden inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-600 text-white text-[10px] font-bold tracking-tight shadow-[0_6px_18px_rgba(225,29,72,0.4)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer"
                      type="button"
                    >
                      {/* Subtle Continuous Shimmer Sweep */}
                      <span className="pointer-events-none absolute inset-0 -top-full -bottom-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer" />
                      <svg className="size-3 relative z-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="relative z-10">Pay</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Mode Banner ── */}
      {editing && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 flex items-center gap-2">
          <span className="animate-pulse">✥</span>
          <span>Drag tables to rearrange floor layout. Click <strong>Save Layout</strong> when done.</span>
        </div>
      )}

      {/* ── Floor Map / Card Grid ── */}
      {rows.length === 0 ? (
        <EmptyState
          icon="🪑"
          title="No tables configured"
          hint="Add tables to set up your restaurant floor map."
          action={
            isOwner ? (
              <Button onClick={() => setFormTable({})} className="bg-rose-600 text-white font-bold rounded-xl">
                + Add First Table
              </Button>
            ) : null
          }
        />
      ) : (
        <FloorMap
          tables={rows}
          editing={editing}
          onTableClick={openTable}
          onLayoutChange={moveTable}
          onPayClick={handlePayClick}
          onTransferClick={handleTransferClick}
          onVoidClick={handleVoidClick}
        />
      )}


      {/* ── Table Form Modal ── */}
      {formTable !== null && (
        <TableFormModal
          table={formTable.id ? formTable : null}
          onClose={() => setFormTable(null)}
          onSaved={(saved, wasNew) => {
            setRows((cur) =>
              wasNew ? [...cur, saved] : cur.map((t) => (t.id === saved.id ? saved : t)),
            )
            setFormTable(null)
            toast.success(`Table ${saved.number} ${wasNew ? 'added' : 'updated'}.`)
          }}
          onDeleted={(deleted) => {
            setRows((cur) => cur.filter((t) => t.id !== deleted.id))
            setFormTable(null)
            toast.success(`Table ${deleted.number} removed.`)
          }}
        />
      )}

      <TransferModal 
        tables={rows}
        sourceTable={transferringTable}
        onClose={() => setTransferringTable(null)}
        onTransfer={handleTransferSubmit}
      />

      <VoidOrderModal
        table={voidingTable}
        onClose={() => setVoidingTable(null)}
        onConfirm={handleVoidConfirm}
      />

      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          onClose={() => {
            setPayingOrder(null)
            load() // Refresh tables
          }}
          onPaid={() => {
            setPayingOrder(null)
            load() // Refresh tables
          }}
        />
      )}

      {quickCustomerOpen && (
        <QuickCustomerModal
          open={quickCustomerOpen}
          minRedeemPoints={0}
          maxRedeemable={0}
          mandatory={Boolean(settings?.customer_details_mandatory)}
          onClose={() => {
            setQuickCustomerOpen(false)
            setPendingOrder(null)
          }}
          onSaveAndProceed={handleQuickCustomerSave}
          onSkipAndProceed={handleQuickCustomerSkip}
        />
      )}

      {takeawayNameModalOpen && (
        <TakeawayNameModal
          open={takeawayNameModalOpen}
          onClose={() => setTakeawayNameModalOpen(false)}
          onSubmit={handleConfirmTakeawayName}
        />
      )}
    </div>
  )
}
