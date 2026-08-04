import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { orders as orderApi, restaurantSettings } from '@/services/billing'
import { categories as categoryApi, items as itemApi } from '@/services/menu'
import { tables as tableApi, TABLE_STATUS } from '@/services/tables'
import { money } from '@/utils/format'
import { Badge, PageLoader } from '@/components/ui/Misc'
import MenuGrid from '@/components/pos/MenuGrid'
import CartPanel from '@/components/pos/CartPanel'
import OwnerAuthModal from '@/components/pos/OwnerAuthModal'
import PaymentModal from '@/components/pos/PaymentModal'
import CustomerPickerModal from '@/components/customers/CustomerPickerModal'
import QuickCustomerModal from '@/components/customers/QuickCustomerModal'
import TableHoverTooltip from '@/components/tables/TableHoverTooltip'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import ThermalKOT from '@/components/print/ThermalKOT'
import {
  IconPos,
  IconTables,
  IconChevronRight,
} from '@/components/ui/Icons'

export default function POS() {
  const [params, setParams] = useSearchParams()
  const tableId = params.get('table')
  const toast = useToast()
  const navigate = useNavigate()

  const [menu, setMenu] = useState({ items: [], categories: [] })
  const [settings, setSettings] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTakeawaysList, setActiveTakeawaysList] = useState([])
  const [showTakeawaysModal, setShowTakeawaysModal] = useState(false)

  const [discount, setDiscount] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [totals, setTotals] = useState(null)
  const [needsApproval, setNeedsApproval] = useState(false)

  const [busyVariant, setBusyVariant] = useState(null)
  const [busyItemId, setBusyItemId] = useState(null)
  const [sendingKot, setSendingKot] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [kotSlip, setKotSlip] = useState(null)
  const [ownerAuth, setOwnerAuth] = useState(null)
  const [pickingCustomer, setPickingCustomer] = useState(false)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [bill, setBill] = useState(null)

  // Fetch menu, settings and active open takeaway orders
  useEffect(() => {
    Promise.all([
      itemApi.list().catch(() => []),
      categoryApi.list().catch(() => []),
      restaurantSettings.get().catch(() => null),
      orderApi.listOpen().catch(() => []),
    ])
      .then(([items, categories, config, openOrders]) => {
        setMenu({ items, categories })
        setSettings(config)
        setActiveTakeawaysList(openOrders.filter((o) => o.order_type === 'TAKEAWAY' && o.has_kots))
      })
      .catch((error) => toast.error(errorMessage(error, 'Failed to load menu.')))
  }, [toast])

  const orderIdParam = params.get('order')

  useEffect(() => {
    if (!tableId && !orderIdParam) {
      setOrder(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    const request = tableId
      ? orderApi.open(Number(tableId))
      : orderApi.get(Number(orderIdParam))

    request
      .then((data) => {
        if (cancelled) return
        setOrder(data)
        setDiscount('')
        setRedeemPoints(0)
        if (data.status === 'BILLED' && data.bill) setBill(data.bill)
      })
      .catch((error) => {
        if (cancelled) return
        toast.error(errorMessage(error, 'Failed to load order.'))
        setParams({}, { replace: true })
      })
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [tableId, orderIdParam, toast, setParams])

  const orderId = order?.id
  const subtotal = order?.subtotal
  const customerId = order?.customer
  const previewSeq = useRef(0)

  useEffect(() => {
    if (!orderId) return
    const seq = ++previewSeq.current
    const timer = setTimeout(() => {
      orderApi
        .preview(orderId, {
          discountPercent: discount === '' ? '0' : discount,
          redeemPoints,
        })
        .then((data) => {
          if (seq !== previewSeq.current) return
          setTotals(data)
          setNeedsApproval(data.needs_owner_approval)
          if (data.points_capped) setRedeemPoints(data.points_redeemed)
        })
        .catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [orderId, subtotal, discount, redeemPoints, customerId])

  const refreshOrder = useCallback(async () => {
    if (!orderId) return
    setOrder(await orderApi.get(orderId))
    orderApi.listOpen().then((openOrders) => {
      setActiveTakeawaysList(openOrders.filter((o) => o.order_type === 'TAKEAWAY' && o.has_kots))
    }).catch(() => {})
  }, [orderId])

  const addItem = async (variant) => {
    setBusyVariant(variant.id)
    try {
      await orderApi.addItem(order.id, { variant: variant.id, quantity: 1 })
      await refreshOrder()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add item.'))
    } finally {
      setBusyVariant(null)
    }
  }

  const changeQuantity = async (line, quantity) => {
    setBusyItemId(line.id)
    try {
      if (quantity < 1) {
        await orderApi.removeItem(order.id, line.id)
      } else {
        await orderApi.updateItem(order.id, line.id, { quantity })
      }
      await refreshOrder()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update quantity.'))
    } finally {
      setBusyItemId(null)
    }
  }

  const removeItem = async (line) => {
    setBusyItemId(line.id)
    try {
      await orderApi.removeItem(order.id, line.id)
      await refreshOrder()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to remove item.'))
    } finally {
      setBusyItemId(null)
    }
  }

  const sendKot = async () => {
    setSendingKot(true)
    try {
      const slip = await orderApi.sendKot(order.id)
      await refreshOrder()
      setKotSlip(slip)
      toast.success(`KOT #${slip.number} sent to kitchen`)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to send KOT.'))
    } finally {
      setSendingKot(false)
    }
  }

  const setCustomer = async (customer) => {
    try {
      const updated = await orderApi.setCustomer(order.id, customer?.id ?? null)
      setOrder(updated)
      setRedeemPoints(0)
      setPickingCustomer(false)
      toast.success(customer ? `${customer.name} attached` : 'Customer detached')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to attach customer.'))
    }
  }

  const generateBill = async (ownerUsername, ownerPassword) => {
    setGenerating(true)
    try {
      const payload = {
        discount_percent: discount === '' ? '0' : discount,
        redeem_points: redeemPoints,
      }
      if (ownerUsername) {
        payload.owner_username = ownerUsername
        payload.owner_password = ownerPassword
      }
      const created = await orderApi.generateBill(order.id, payload)
      setOwnerAuth(null)
      setBill(created)
    } catch (error) {
      const message = errorMessage(error, 'Failed to generate bill.')
      if (ownerUsername) {
        setOwnerAuth((current) => ({ ...current, error: message }))
      } else {
        toast.error(message)
      }
    } finally {
      setGenerating(false)
    }
  }

  const onGenerateBill = () => {
    if (!order?.customer) {
      setQuickCustomerOpen(true)
      return
    }
    proceedWithBillGeneration()
  }

  const proceedWithBillGeneration = () => {
    if (needsApproval) {
      setOwnerAuth({ error: '' })
      return
    }
    generateBill()
  }

  const handleQuickCustomerSave = async (savedCustomer, pointsToRedeem = 0) => {
    try {
      const updated = await orderApi.setCustomer(order.id, savedCustomer.id)
      setOrder(updated)
      setRedeemPoints(pointsToRedeem)
      setQuickCustomerOpen(false)
      toast.success(`Attached ${savedCustomer.name} to bill!`)

      if (needsApproval) {
        setOwnerAuth({ error: '' })
        return
      }

      setGenerating(true)
      try {
        const payload = {
          discount_percent: discount === '' ? '0' : discount,
          redeem_points: pointsToRedeem,
        }
        const created = await orderApi.generateBill(order.id, payload)
        setOwnerAuth(null)
        setBill(created)
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to generate bill.'))
      } finally {
        setGenerating(false)
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to attach customer.'))
    }
  }

  const handleQuickCustomerSkip = () => {
    setQuickCustomerOpen(false)
    proceedWithBillGeneration()
  }

  const finishTable = () => {
    setBill(null)
    setOrder(null)
    setDiscount('')
    setRedeemPoints(0)
    navigate('/tables')
  }

  const startTakeaway = async () => {
    try {
      const takeawayOrder = await orderApi.createTakeaway()
      setOrder(takeawayOrder)
      setParams({ order: String(takeawayOrder.id) })
      toast.success('Parcel Takeaway Order started!')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to start takeaway order.'))
    }
  }

  if (loading) return <PageLoader label="Loading Lumière POS Terminal…" />
  if (!tableId && !orderIdParam && !order) {
    return (
      <POSStartScreen
        onPickTable={(id) => setParams({ table: String(id) })}
        onPickOrder={(id) => setParams({ order: String(id) })}
        onTakeaway={startTakeaway}
      />
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[#fafaf9]">
      {/* Active POS Header Bar */}
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/tables"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
          >
            ← Floor Map
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <IconPos className="size-5 text-rose-600" />
                {order?.order_type === 'TAKEAWAY' ? `Takeaway Parcel (#TK-${order.id})` : `Table ${order?.table_number ?? ''}`}
              </h1>
              {order?.order_type === 'TAKEAWAY' && (
                <span className="bg-rose-100 text-rose-800 font-black text-[10px] uppercase px-2 py-0.5 rounded-md border border-rose-200">
                  Parcel Counter
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-400">
              Order #{order?.id} · {order?.item_count ?? 0} items in cart
            </p>
          </div>
          <Badge tone={order?.status === 'RUNNING' ? 'red' : 'amber'}>{order?.status_display}</Badge>

          {activeTakeawaysList.length > 0 && (
            <button
              onClick={() => setShowTakeawaysModal(true)}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800 shadow-2xs hover:bg-rose-100 transition active:scale-95"
            >
              <IconPos className="size-4 text-rose-600" />
              <span>{activeTakeawaysList.length} Active Parcels</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPickingCustomer(true)}
            disabled={order?.status !== 'RUNNING'}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 active:scale-95 ${
              order?.customer_detail
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs'
                : 'border-dashed border-slate-300 text-slate-600 hover:border-rose-300 hover:text-rose-600 bg-white'
            }`}
          >
            <span>👤</span>
            {order?.customer_detail ? (
              <span>
                {order.customer_detail.name}
                <span className="ml-1.5 text-[11px] font-extrabold text-emerald-700">
                  ({order.customer_detail.points_balance} pts)
                </span>
              </span>
            ) : (
              '+ Attach Customer'
            )}
          </button>

          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Running Total</span>
            <span className="tabular text-base font-black text-slate-900">{money(order?.subtotal ?? 0)}</span>
          </div>
        </div>
      </header>

      {/* POS Billing Canvas */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left: Menu Browser */}
        <section className="min-h-0 min-w-0 flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto">
          <MenuGrid
            items={menu.items}
            categories={menu.categories}
            busyVariant={busyVariant}
            disabled={order?.status !== 'RUNNING'}
            onAdd={addItem}
          />
        </section>

        {/* Right: Glassmorphism Order Cart */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-slate-200/80 bg-white p-4 sm:p-5 lg:w-80 xl:w-96 lg:border-t-0 lg:border-l shadow-xs">
          <CartPanel
            order={order}
            totals={totals}
            discount={discount}
            maxDiscount={settings?.max_discount_percent ?? 0}
            needsApproval={needsApproval}
            redeemPoints={redeemPoints}
            onRedeemChange={setRedeemPoints}
            busyItemId={busyItemId}
            onQuantity={changeQuantity}
            onRemove={removeItem}
            onDiscountChange={setDiscount}
            onSendKot={sendKot}
            onGenerateBill={onGenerateBill}
            sendingKot={sendingKot}
            generating={generating}
          />
        </aside>
      </div>


      {kotSlip && (
        <PrintSlipModal
          title={`KOT #${kotSlip.number}`}
          subtitle={`Table ${kotSlip.table_number} · ${kotSlip.items.length} lines`}
          onClose={() => setKotSlip(null)}
        >
          <ThermalKOT kot={kotSlip} />
        </PrintSlipModal>
      )}

      {pickingCustomer && (
        <CustomerPickerModal
          attached={order.customer_detail}
          onClose={() => setPickingCustomer(false)}
          onPick={setCustomer}
          onDetach={() => setCustomer(null)}
        />
      )}

      {quickCustomerOpen && (
        <QuickCustomerModal
          open={quickCustomerOpen}
          minRedeemPoints={settings?.loyalty_min_redeem_points ?? 50}
          maxRedeemable={totals?.max_redeemable_points}
          onClose={() => setQuickCustomerOpen(false)}
          onSaveAndProceed={handleQuickCustomerSave}
          onSkipAndProceed={handleQuickCustomerSkip}
        />
      )}

      {ownerAuth && (
        <OwnerAuthModal
          discountPercent={discount}
          maxPercent={settings?.max_discount_percent ?? 0}
          error={ownerAuth.error}
          onCancel={() => setOwnerAuth(null)}
          onConfirm={generateBill}
        />
      )}

      {bill && <PaymentModal bill={bill} onClose={finishTable} />}

      {/* Switch active takeaway orders modal */}
      {showTakeawaysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <IconPos className="size-5 text-rose-600" />
                Active Takeaway Orders ({activeTakeawaysList.length})
              </h3>
              <button
                onClick={() => setShowTakeawaysModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeTakeawaysList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setShowTakeawaysModal(false)
                    setParams({ order: String(t.id) })
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left ${
                    order?.id === t.id
                      ? 'border-rose-300 bg-rose-50 font-bold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-black text-rose-900 uppercase bg-rose-100 px-2 py-0.5 rounded">
                      #TK-{t.id}
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {t.customer_detail?.name || 'Parcel Customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="tabular font-black text-slate-900 text-sm">{money(t.subtotal)}</span>
                    <p className="text-[10px] text-slate-400 font-semibold">{t.item_count} items</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Pixel-Perfect Stitch Lumière POS Start Billing Launcher Screen */
function POSStartScreen({ onPickTable, onPickOrder, onTakeaway }) {
  const [rows, setRows] = useState(null)
  const [openOrders, setOpenOrders] = useState([])
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      tableApi.list().catch(() => []),
      orderApi.listOpen().catch(() => []),
    ])
      .then(([tablesData, ordersData]) => {
        setRows(tablesData)
        setOpenOrders(ordersData)
      })
      .catch((error) => {
        toast.error(errorMessage(error, 'Failed to load POS data.'))
        setRows([])
      })
  }, [toast])

  if (rows === null) return <PageLoader label="Loading Lumière POS Launcher…" />

  const activeTakeaways = openOrders.filter((o) => o.order_type === 'TAKEAWAY' && o.has_kots)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 1. Top Action Banners (Dark Crimson & Charcoal Slate Split) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Banner 1: + Start Takeaway Parcel */}
        <button
          onClick={onTakeaway}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-[#c80036] p-4 text-left text-white shadow-lg shadow-rose-900/10 transition-all duration-150 hover:bg-[#b0002f] active:scale-[0.99]"
        >
          {/* Watermark Bag Icon on right */}
          <div className="absolute -right-3 -bottom-3 opacity-10 pointer-events-none text-white">
            <svg className="size-28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h6v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/>
            </svg>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner backdrop-blur-md">
              <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">+ Start Takeaway Parcel</h2>
              <p className="text-xs font-semibold text-rose-200">+ Start New Parcel</p>
            </div>
          </div>

          <div className="z-10 flex items-center gap-2">
            {activeTakeaways.length > 0 && (
              <span className="rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs backdrop-blur-md">
                {activeTakeaways.length} RUNNING
              </span>
            )}
          </div>
        </button>

        {/* Banner 2: Dine-in Floor Map */}
        <button
          onClick={() => navigate('/tables')}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-[#282a2c] p-4 text-left text-white shadow-lg shadow-slate-900/10 transition-all duration-150 hover:bg-[#1f2123] active:scale-[0.99]"
        >
          {/* Watermark Seating Icon on right */}
          <div className="absolute -right-3 -bottom-3 opacity-10 pointer-events-none text-white">
            <svg className="size-28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 18v3h2v-3h12v3h2v-3c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2zm3-10h10c.55 0 1 .45 1 1v4H6V9c0-.55.45-1 1-1z"/>
            </svg>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-md">
              <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Dine-in Floor Map</h2>
              <p className="text-xs font-semibold text-slate-400">View Seating Floor Map</p>
            </div>
          </div>

          <div className="z-10">
            <svg className="size-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* 2. Active Takeaway Parcels Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Active Takeaway Parcels</h2>
            <p className="text-[11px] font-semibold text-slate-400">
              Managing {activeTakeaways.length} ongoing takeaway orders
            </p>
          </div>
          {activeTakeaways.length > 0 && (
            <button
              onClick={() => navigate('/orders')}
              className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-slate-200 transition"
            >
              VIEW ALL →
            </button>
          )}
        </div>

        {activeTakeaways.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white p-6 text-center">
            <p className="text-xs font-bold text-slate-400">No active takeaway parcels running</p>
            <button
              onClick={onTakeaway}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white"
            >
              + Create First Takeaway
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activeTakeaways.map((takeaway, idx) => {
              const borderStyles = [
                'border-emerald-500',
                'border-slate-400',
                'border-rose-500',
                'border-pink-300',
              ]
              const cardBorder = borderStyles[idx % borderStyles.length]
              const isFirst = idx === 0

              return (
                <div
                  key={takeaway.id}
                  className={`flex flex-col justify-between rounded-2xl border-t-4 border-x border-b border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md ${cardBorder}`}
                >
                  <div>
                    {/* Top Row: #TK-ID Badge + Price */}
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 font-mono">
                        #TK-{takeaway.id}
                      </span>
                      <span className="tabular text-sm font-black text-slate-900">
                        {money(takeaway.subtotal)}
                      </span>
                    </div>

                    {/* Customer Name + Status */}
                    <div className="mt-2.5">
                      <h3 className="text-sm font-black text-slate-900 truncate">
                        {takeaway.customer_detail?.name || 'Parcel Customer'}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {takeaway.item_count} Items • Ready Counter
                      </p>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <button
                    onClick={() => onPickOrder(takeaway.id)}
                    className={`mt-4 w-full rounded-xl py-2 text-xs font-black transition active:scale-95 ${
                      isFirst
                        ? 'bg-[#c80036] text-white shadow-md shadow-rose-600/20 hover:bg-[#b0002f]'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70'
                    }`}
                  >
                    Open Parcel Bill
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Active Dine-in Tables Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Active Dine-in Tables</h2>
            <p className="text-[11px] font-semibold text-slate-400">Real-time floor status and table occupancy</p>
          </div>

          {/* Status Legend Pill */}
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" /> VACANT
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-600" /> OCCUPIED
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-slate-400" /> BILLING
            </span>
          </div>
        </div>

        {/* Table Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map((table) => {
            const isOccupied = table.status === 'OCCUPIED'
            const isBilled = table.status === 'BILLED'
            const isVacant = table.status === 'AVAILABLE' || (!isOccupied && !isBilled)

            return (
              <TableHoverTooltip key={table.id} table={table} className="w-full">
                <button
                  onClick={() => onPickTable(table.id)}
                  className={`w-full flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-95 ${
                    isBilled
                      ? 'border-2 border-rose-600 bg-white shadow-md shadow-rose-600/10'
                      : isOccupied
                      ? 'border-slate-200 bg-white hover:border-rose-300'
                      : 'border-slate-200/80 bg-white opacity-85 hover:opacity-100 hover:border-emerald-300'
                  }`}
                >
                  {/* Top: Table Number + Seats Pill */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-lg font-black block leading-none ${isBilled ? 'text-rose-600' : 'text-slate-900'}`}>
                        {String(table.number).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">TABLE</span>
                    </div>

                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isBilled
                          ? 'bg-rose-600 text-white'
                          : isOccupied
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {table.seats} SEATS
                    </span>
                  </div>

                  {/* Bottom: Running Total + Status */}
                  <div className="mt-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <span
                        className={`size-1.5 rounded-full ${
                          isBilled ? 'bg-slate-500' : isOccupied ? 'bg-rose-600' : 'bg-emerald-500'
                        }`}
                      />
                      <span className="tabular text-xs font-black text-slate-900">
                        {money(table.running_total ?? 0)}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider block mt-0.5 ${
                        isBilled
                          ? 'text-slate-500'
                          : isOccupied
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {isBilled ? 'BILLING...' : isOccupied ? 'OCCUPIED' : 'VACANT'}
                    </span>
                  </div>
                </button>
              </TableHoverTooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
