import { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { money } from '@/utils/format'
import { orders as orderApi, bills as billApi, restaurantSettings, PAYMENT_MODES } from '@/services/billing'
import { errorMessage } from '@/services/api'
import ThermalBill from '@/components/print/ThermalBill'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import { CouponInput, DiscountInput, LoyaltyRow } from '@/components/pos/CartPanel'

export default function PaymentModal({ order: initialOrder, onClose, onPaid }) {
  const [order, setOrder] = useState(initialOrder)
  const [settings, setSettings] = useState(null)
  const [bill, setBill] = useState(initialOrder?.bill ?? null)
  const [totals, setTotals] = useState(null)
  const [discount, setDiscount] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [mode, setMode] = useState('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  // Dispute & Item Editing state
  const [editingItems, setEditingItems] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState(null)

  // Cash Tendered calculator state
  const [cashTendered, setCashTendered] = useState('')

  // Split payment state
  const [splitCash, setSplitCash] = useState('')
  const [splitOnline, setSplitOnline] = useState('')

  const paid = bill?.status === 'PAID'

  // Refresh Order & Totals
  const refreshOrderAndTotals = async () => {
    try {
      const updatedOrder = await orderApi.get(order.id)
      setOrder(updatedOrder)

      const payload = {
        discount_percent: discount === '' ? '0' : discount,
        redeem_points: redeemPoints,
      }
      const preview = await orderApi.preview(order.id, payload)
      setTotals(preview)
    } catch (err) {
      console.error('Failed to refresh order/totals:', err)
    }
  }

  // Preview Totals
  useEffect(() => {
    let active = true
    const fetchPreview = async () => {
      try {
        const payload = {
          discount_percent: discount === '' ? '0' : discount,
          redeem_points: redeemPoints,
        }
        const preview = await orderApi.preview(order.id, payload)
        if (active) setTotals(preview)
        
        if (active && !settings) {
          const sysSettings = await restaurantSettings.get()
          setSettings(sysSettings)
        }
      } catch (err) {
        console.error('Failed to preview totals:', err)
      }
    }
    
    if (!paid) {
      fetchPreview()
    }
    return () => { active = false }
  }, [order.id, discount, redeemPoints, paid])

  // Optimistic & Instant Local Order Recalculation
  const updateLocalOrderItems = (itemId, updates) => {
    setOrder((prev) => {
      if (!prev || !prev.items) return prev
      let updatedItems
      if (updates === null) {
        updatedItems = prev.items.filter((it) => it.id !== itemId)
      } else {
        updatedItems = prev.items.map((it) => {
          if (it.id === itemId) {
            const newUnitPrice = updates.unit_price !== undefined ? updates.unit_price : it.unit_price
            const newQty = updates.quantity !== undefined ? updates.quantity : it.quantity
            const newLineTotal = (Number(newUnitPrice) || 0) * (Number(newQty) || 0)
            return {
              ...it,
              ...updates,
              unit_price: newUnitPrice,
              quantity: newQty,
              line_total: newLineTotal.toFixed(2),
            }
          }
          return it
        })
      }
      const newSubtotal = updatedItems.reduce(
        (acc, it) => acc + ((Number(it.unit_price) || 0) * (Number(it.quantity) || 0)),
        0
      )
      return {
        ...prev,
        items: updatedItems,
        subtotal: newSubtotal.toFixed(2),
      }
    })
  }

  const rateDebounceRef = useRef({})

  const handleUpdateItemRate = (item, newRate) => {
    // 1. Instant 0ms UI update
    updateLocalOrderItems(item.id, { unit_price: newRate })

    // 2. Debounced API save
    if (rateDebounceRef.current[item.id]) {
      clearTimeout(rateDebounceRef.current[item.id])
    }

    if (newRate === '' || isNaN(newRate) || Number(newRate) < 0) return

    rateDebounceRef.current[item.id] = setTimeout(async () => {
      try {
        await orderApi.updateItem(order.id, item.id, { unit_price: newRate })
        const preview = await orderApi.preview(order.id, {
          discount_percent: discount === '' ? '0' : discount,
          redeem_points: redeemPoints,
        })
        setTotals(preview)
      } catch (err) {
        console.error('Failed to sync item price:', err)
      }
    }, 400)
  }

  const handleUpdateItemQty = async (item, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(item.id)
      return
    }
    // 1. Instant 0ms UI update
    updateLocalOrderItems(item.id, { quantity: newQty })

    // 2. Background API save
    try {
      await orderApi.updateItem(order.id, item.id, { quantity: newQty })
      const preview = await orderApi.preview(order.id, {
        discount_percent: discount === '' ? '0' : discount,
        redeem_points: redeemPoints,
      })
      setTotals(preview)
    } catch (err) {
      console.error('Failed to sync item quantity:', err)
    }
  }

  const handleRemoveItem = async (itemId) => {
    // 1. Instant 0ms UI remove
    updateLocalOrderItems(itemId, null)

    // 2. Background API save
    try {
      await orderApi.removeItem(order.id, itemId)
      const preview = await orderApi.preview(order.id, {
        discount_percent: discount === '' ? '0' : discount,
        redeem_points: redeemPoints,
      })
      setTotals(preview)
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  const proceedWithPayment = async () => {
    setBusy(true)
    setError('')
    try {
      // 1. Generate Bill
      const payload = {
        discount_percent: discount === '' ? '0' : discount,
        redeem_points: redeemPoints,
      }
      const newBill = await orderApi.generateBill(order.id, payload)
      
      // 2. Pay Bill
      const updated = await billApi.pay(newBill.id, mode)
      setBill(updated)
      onPaid?.(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to process payment.'))
    } finally {
      setBusy(false)
    }
  }

  if (printing && bill) {
    return (
      <PrintSlipModal
        title={`Bill ${bill.bill_number}`}
        subtitle={`Table ${bill.table_number || 'Parcel'} · ${money(bill.net_payable)}`}
        onClose={() => setPrinting(false)}
      >
        <ThermalBill bill={bill} />
      </PrintSlipModal>
    )
  }

  // Real-time Subtotal calculated directly from items
  const liveItemsSubtotal = order?.items?.length > 0
    ? order.items.reduce((sum, it) => sum + (Number(it.unit_price || 0) * Number(it.quantity || 0)), 0)
    : Number(order?.subtotal || 0)

  const parsedSubtotal = Number(paid ? bill.subtotal : liveItemsSubtotal)
  const discountPct = Number(discount || 0)
  
  // Instant dynamic calculations (0ms lag on keypress)
  const calcDiscountAmount = (parsedSubtotal * discountPct) / 100
  const calcTaxable = Math.max(0, parsedSubtotal - calcDiscountAmount)
  const cgstRate = Number(paid ? bill.cgst_percent : (totals?.cgst_percent ?? settings?.cgst_percent ?? 2.5))
  const sgstRate = Number(paid ? bill.sgst_percent : (totals?.sgst_percent ?? settings?.sgst_percent ?? 2.5))
  const calcCgstAmount = (calcTaxable * cgstRate) / 100
  const calcSgstAmount = (calcTaxable * sgstRate) / 100
  const calcTotal = calcTaxable + calcCgstAmount + calcSgstAmount
  const calcPointsRedeemed = Number(paid ? bill.points_redeemed : (totals?.points_redeemed ?? redeemPoints ?? 0))
  const calcRedeemAmount = Number(paid ? bill.redeem_amount : (totals?.redeem_amount ?? redeemPoints ?? 0))
  const calcDue = Math.max(0, calcTotal - calcRedeemAmount)

  const due = paid ? bill.net_payable : calcDue.toFixed(2)
  const hasRedeem = paid ? Number(bill.redeem_amount) > 0 : calcRedeemAmount > 0
  
  const displaySubtotal = paid ? bill.subtotal : parsedSubtotal.toFixed(2)
  const displayDiscountAmount = paid ? bill.discount_amount : calcDiscountAmount.toFixed(2)
  const displayDiscountPercent = paid ? bill.discount_percent : discountPct.toFixed(1)
  const displayCgstPercent = cgstRate
  const displayCgstAmount = paid ? bill.cgst_amount : calcCgstAmount.toFixed(2)
  const displaySgstPercent = sgstRate
  const displaySgstAmount = paid ? bill.sgst_amount : calcSgstAmount.toFixed(2)
  const displayGrossTotal = paid ? bill.total : calcTotal.toFixed(2)
  const displayPointsRedeemed = calcPointsRedeemed
  const displayRedeemAmount = calcRedeemAmount.toFixed(2)

  const calculatedChange = Number(cashTendered) > 0 ? Number(cashTendered) - Number(due) : 0

  return (
    <Modal
      open
      size="md"
      onClose={onClose}
      title={paid ? '✅ Payment Complete' : `Checkout · ${order.table_number ? `Table ${order.table_number}` : 'Takeaway'}`}
      subtitle={
        paid
          ? `Order #${order.id} paid successfully`
          : `Total amount due: ${money(due)}`
      }
      footer={
        paid ? (
          <>
            <Button variant="secondary" onClick={() => setPrinting(true)}>
              🖨 Print Bill
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={proceedWithPayment} loading={busy || !totals}>
              Collect & Settle {money(due)}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Dispute / Item & Rate Edit Section */}
        {!paid && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                ✏️ Edit Items / Settle Dispute
              </span>
              <button
                type="button"
                onClick={() => setEditingItems(!editingItems)}
                className="text-xs font-medium text-amber-700 underline hover:text-amber-900"
              >
                {editingItems ? 'Done Editing' : 'Edit Item Rates & Quantities'}
              </button>
            </div>

            {editingItems && (
              <div className="mt-3 space-y-2 border-t border-amber-200/60 pt-2">
                <p className="text-[11px] text-amber-800">
                  Change item rate or quantity if customer disputes prices at checkout:
                </p>
                <div className="divide-y divide-amber-200/50 max-h-48 overflow-y-auto">
                  {order.items?.map((item) => {
                    const itemLineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0)
                    return (
                      <div key={item.id} className="py-2 flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate">{item.item_name}</p>
                          <p className="text-[10px] text-slate-500">
                            {item.portion && `(${item.portion}) `}
                            <span className="tabular font-bold text-amber-900">Total: ₹{itemLineTotal.toFixed(2)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Rate Edit */}
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.unit_price ?? ''}
                              onChange={(e) => handleUpdateItemRate(item, e.target.value)}
                              className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 text-right font-mono font-bold text-slate-900 bg-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* Qty Edit */}
                          <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item, Number(item.quantity || 1) - 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-black active:scale-95"
                            >
                              -
                            </button>
                            <span className="px-2 font-mono font-black text-slate-800">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item, Number(item.quantity || 1) + 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-black active:scale-95"
                            >
                              +
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Remove item"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discounts, Coupons & Loyalty */}
        {!paid && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DiscountInput
                discount={discount}
                onChangeDiscount={(val) => setDiscount(val)}
                subtotal={displaySubtotal || order?.subtotal || 0}
              />
              <CouponInput
                subtotal={displaySubtotal || 0}
                customerId={order.customer}
                onApplyDiscount={(val) => setDiscount(val)}
              />
            </div>
            {order.customer && (
              <LoyaltyRow
                totals={totals}
                redeemPoints={redeemPoints}
                onRedeemChange={(val) => setRedeemPoints(val)}
                hasCustomer={true}
              />
            )}
          </div>
        )}

        {/* Bill Summary Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dl className="space-y-1 text-sm">
            <Row label="Sub Total" value={displaySubtotal} />
            {Number(displayDiscountAmount) > 0 && (
              <div className="flex items-center justify-between text-xs py-1">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  🏷️ Discount ({Number(displayDiscountPercent).toFixed(1)}%)
                </span>
                <span className="tabular font-semibold text-emerald-700">-{money(displayDiscountAmount)}</span>
              </div>
            )}
            <Row label={`CGST ${Number(displayCgstPercent).toFixed(2)}%`} value={displayCgstAmount} />
            <Row label={`SGST ${Number(displaySgstPercent).toFixed(2)}%`} value={displaySgstAmount} />
          </dl>
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-300 pt-2">
            <span className={hasRedeem ? 'text-sm text-slate-500' : 'font-semibold text-slate-900'}>
              Total
            </span>
            <span
              className={`tabular ${hasRedeem ? 'text-sm text-slate-500' : 'text-2xl font-bold text-slate-900'}`}
            >
              {money(displayGrossTotal)}
            </span>
          </div>

          {hasRedeem && (
            <>
              <div className="mt-1 flex items-center justify-between text-xs py-1">
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  ⭐ Points Redeemed ({displayPointsRedeemed} Pts)
                </span>
                <span className="tabular font-semibold text-brand-700">-{money(displayRedeemAmount)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-slate-300 pt-1.5">
                <span className="font-semibold text-slate-900">Amount Payable</span>
                <span className="tabular text-2xl font-bold text-slate-900">
                  {money(due)}
                </span>
              </div>
            </>
          )}

          {order.customer_name && (
            <p className="mt-2 text-xs text-slate-500">
              {order.customer_name} · {order.customer_phone}
              {bill && bill.points_earned > 0 && (
                <span className="text-emerald-700">
                  {' '}
                  · +{bill.points_earned} points earned
                </span>
              )}
            </p>
          )}
        </div>

        {/* Payment Modes Selection */}
        {paid ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
            Received {money(due)} via {bill.payment_mode_display}.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Select Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition ${
                    mode === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-900 font-bold shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {option.icon}
                  </span>
                  <span className="text-xs font-medium text-center">{option.label}</span>
                </button>
              ))}
            </div>

            {/* Cash Tendered Calculator */}
            {mode === 'CASH' && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Cash Received from Customer:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      placeholder={due}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-right font-bold text-slate-900 text-sm"
                    />
                  </div>
                </div>

                {/* Quick denomination chips */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-400 self-center">Quick:</span>
                  {[Math.ceil(due), 100, 200, 500, 1000].map((amt) => (
                    amt >= due && (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(String(amt))}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        ₹{amt}
                      </button>
                    )
                  ))}
                </div>

                {calculatedChange > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                    <span className="font-semibold text-emerald-700">Change to Return:</span>
                    <span className="font-extrabold text-emerald-700 text-lg tabular">
                      ₹{money(calculatedChange)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Split Payment Helper */}
            {mode === 'SPLIT' && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2 text-xs">
                <p className="font-semibold text-indigo-900">🔀 Split Payment Breakdown</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-600 block mb-1">Cash Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitCash}
                      onChange={(e) => {
                        const val = e.target.value
                        setSplitCash(val)
                        if (val && !isNaN(val)) {
                          setSplitOnline(String(Math.max(0, Number(due) - Number(val))))
                        }
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-right font-medium text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">UPI / Card Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitOnline}
                      onChange={(e) => setSplitOnline(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-right font-medium text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Udhar / Credit Warning */}
            {mode === 'DUE' && (
              <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                📋 Bill will be recorded under Customer's Credit / Udhar balance for later settlement.
              </p>
            )}

            <p className="text-xs text-slate-400">
              Selected payment mode will be recorded on the thermal receipt and sales reports.
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Row({ label, value, tone = 'text-slate-700' }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular ${tone}`}>{money(value)}</dd>
    </div>
  )
}
