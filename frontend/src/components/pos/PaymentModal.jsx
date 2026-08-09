import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { money } from '@/utils/format'
import { orders as orderApi, bills as billApi, restaurantSettings, PAYMENT_MODES } from '@/services/billing'
import { errorMessage } from '@/services/api'
import ThermalBill from '@/components/print/ThermalBill'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import { CouponInput, LoyaltyRow } from '@/components/pos/CartPanel'

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

  const handleUpdateItemRate = async (item, newRate) => {
    if (newRate === '' || isNaN(newRate) || Number(newRate) < 0) return
    setUpdatingItemId(item.id)
    try {
      await orderApi.updateItem(order.id, item.id, { unit_price: newRate })
      await refreshOrderAndTotals()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update item price.'))
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleUpdateItemQty = async (item, newQty) => {
    setUpdatingItemId(item.id)
    try {
      if (newQty <= 0) {
        await orderApi.removeItem(order.id, item.id)
      } else {
        await orderApi.updateItem(order.id, item.id, { quantity: newQty })
      }
      await refreshOrderAndTotals()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update item quantity.'))
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleRemoveItem = async (itemId) => {
    setUpdatingItemId(itemId)
    try {
      await orderApi.removeItem(order.id, itemId)
      await refreshOrderAndTotals()
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove item.'))
    } finally {
      setUpdatingItemId(null)
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

  const due = paid ? bill.net_payable : (totals?.net_payable ?? totals?.total ?? bill?.net_payable ?? 0)
  const hasRedeem = paid ? Number(bill.redeem_amount) > 0 : Number(totals?.redeem_amount) > 0
  
  const displaySubtotal = paid ? bill.subtotal : (totals?.subtotal ?? bill?.subtotal)
  const displayDiscountAmount = paid ? bill.discount_amount : (totals?.discount_amount ?? bill?.discount_amount)
  const displayDiscountPercent = paid ? bill.discount_percent : (totals?.discount_percent ?? bill?.discount_percent ?? discount)
  const displayCgstPercent = paid ? bill.cgst_percent : (totals?.cgst_percent ?? bill?.cgst_percent)
  const displayCgstAmount = paid ? bill.cgst_amount : (totals?.cgst_amount ?? bill?.cgst_amount)
  const displaySgstPercent = paid ? bill.sgst_percent : (totals?.sgst_percent ?? bill?.sgst_percent)
  const displaySgstAmount = paid ? bill.sgst_amount : (totals?.sgst_amount ?? bill?.sgst_amount)
  const displayGrossTotal = paid ? bill.total : (totals?.total ?? bill?.total)
  const displayPointsRedeemed = paid ? bill.points_redeemed : (totals?.points_redeemed ?? bill?.points_redeemed)
  const displayRedeemAmount = paid ? bill.redeem_amount : (totals?.redeem_amount ?? bill?.redeem_amount)

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
                  {order.items?.map((item) => (
                    <div key={item.id} className="py-1.5 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800">{item.item_name}</span>
                        <span className="text-[10px] text-slate-500 ml-1">({item.portion})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Rate Edit */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            step="1"
                            disabled={updatingItemId === item.id}
                            defaultValue={item.unit_price}
                            onBlur={(e) => handleUpdateItemRate(item, e.target.value)}
                            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right font-medium text-slate-900 bg-white"
                          />
                        </div>

                        {/* Qty Edit */}
                        <div className="flex items-center rounded border border-slate-300 bg-white">
                          <button
                            type="button"
                            disabled={updatingItemId === item.id}
                            onClick={() => handleUpdateItemQty(item, item.quantity - 1)}
                            className="px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 font-bold"
                          >
                            -
                          </button>
                          <span className="px-1.5 font-semibold text-slate-800">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={updatingItemId === item.id}
                            onClick={() => handleUpdateItemQty(item, item.quantity + 1)}
                            className="px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 font-bold"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          disabled={updatingItemId === item.id}
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coupons & Loyalty */}
        {!paid && (
          <div className="space-y-3">
            <CouponInput
              subtotal={displaySubtotal || 0}
              customerId={order.customer}
              onApplyDiscount={(val) => setDiscount(val)}
            />
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
