import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { money } from '@/utils/format'
import { orders as orderApi, bills as billApi, restaurantSettings } from '@/services/billing'
import { errorMessage } from '@/services/api'
import ThermalBill from '@/components/print/ThermalBill'
import PrintSlipModal from '@/components/print/PrintSlipModal'
import { CouponInput, LoyaltyRow } from '@/components/pos/CartPanel'

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash', icon: '💵' },
  { value: 'UPI', label: 'UPI / QR', icon: '📱' },
  { value: 'CARD', label: 'Card / POS', icon: '💳' },
]

export default function PaymentModal({ order, onClose, onPaid }) {
  const [settings, setSettings] = useState(null)
  const [bill, setBill] = useState(order?.bill ?? null)
  const [totals, setTotals] = useState(null)
  const [discount, setDiscount] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [mode, setMode] = useState('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  const paid = bill?.status === 'PAID'
  
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
        
        // Also fetch settings if needed for max_discount
        if (active && !settings) {
          const sysSettings = await restaurantSettings.get()
          setSettings(sysSettings)
        }
      } catch (err) {
        console.error('Failed to preview totals:', err)
      }
    }
    
    if (!bill) {
      fetchPreview()
    }
    return () => { active = false }
  }, [order.id, discount, redeemPoints, bill])

  const maxDiscount = settings?.max_discount_percent ?? 0

  const handlePayClick = () => {
    proceedWithPayment()
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
        subtitle={`Table ${bill.table_number} · ${money(bill.net_payable)}`}
        onClose={() => setPrinting(false)}
      >
        <ThermalBill bill={bill} />
      </PrintSlipModal>
    )
  }

  const due = bill ? bill.net_payable : (totals?.total || 0)
  const hasRedeem = bill ? Number(bill.redeem_amount) > 0 : (totals?.redeem_amount > 0)
  
  const displaySubtotal = bill ? bill.subtotal : totals?.subtotal
  const displayDiscountAmount = bill ? bill.discount_amount : totals?.discount_amount
  const displayDiscountPercent = bill ? bill.discount_percent : (totals?.discount_percent || discount)
  const displayCgstPercent = bill ? bill.cgst_percent : totals?.cgst_percent
  const displayCgstAmount = bill ? bill.cgst_amount : totals?.cgst_amount
  const displaySgstPercent = bill ? bill.sgst_percent : totals?.sgst_percent
  const displaySgstAmount = bill ? bill.sgst_amount : totals?.sgst_amount
  const displayGrossTotal = bill ? bill.total : totals?.total
  const displayPointsRedeemed = bill ? bill.points_redeemed : totals?.points_redeemed
  const displayRedeemAmount = bill ? bill.redeem_amount : totals?.redeem_amount

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={paid ? '✅ Payment Complete' : `Checkout · Table ${order.table_number}`}
      subtitle={
        paid
          ? `Table ${order.table_number} is now available`
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
            <Button onClick={handlePayClick} loading={busy || !totals}>
              Collect {money(due)}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
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
          {bill?.approved_by_name && (
            <p className="mt-1 text-xs text-amber-700">
              Discount approved by {bill.approved_by_name}
            </p>
          )}
        </div>

        {paid ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
            Received {money(due)} via {bill.payment_mode_display}.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 transition ${
                    mode === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {option.icon}
                  </span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Only amount and payment mode are recorded — card or UPI details are never saved.
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
