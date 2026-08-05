import { useState } from 'react'
import { money, priceShort } from '@/utils/format'
import Button from '@/components/ui/Button'
import { Badge, FoodTypeDot } from '@/components/ui/Misc'
import { couponsService } from '@/services/coupons'
import {
  IconKitchen,
  IconPlus,
  IconMinus,
  IconTrash,
  IconPos,
  IconReceipt,
  IconSparkles,
} from '@/components/ui/Icons'

export default function CartPanel({
  order,
  totals,
  busyItemId,
  onQuantity,
  onRemove,
  onSendKot,
  onGenerateBill,
  onPayBill,
  onAddCustomItem,
  sendingKot,
  generating,
}) {
  const items = order?.items ?? []
  const unsentCount = items.filter((l) => !l.sent_to_kitchen).length

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Order Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Order Summary</h2>
          <p className="text-base font-black text-slate-900 flex items-center gap-2">
            <IconPos className="size-4 text-rose-600" />
            {order?.order_type === 'TAKEAWAY' ? 'Takeaway Parcel' : `Table ${order?.table_number ?? ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddCustomItem}
            className="flex items-center gap-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-bold hover:bg-amber-100 transition-all active:scale-95 shadow-2xs"
            title="Add a custom item not listed in the menu"
          >
            + Custom Item
          </button>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700 border border-slate-200">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconPos className="size-7" />
            </div>
            <p className="text-sm font-extrabold text-slate-800">Cart is empty</p>
            <p className="text-xs text-slate-400">Tap dishes from the left menu grid to add</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((line) => (
              <li key={line.id} className="group flex items-start gap-2 py-1.5 transition-colors">
                <FoodTypeDot foodType={line.food_type} className="mt-0.5" />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold leading-tight text-slate-900">
                    {line.item_name}
                    {line.portion === 'HALF' && (
                      <span className="ml-1 text-[10px] font-bold text-rose-600">(Half)</span>
                    )}
                  </p>
                  <p className="tabular text-[11px] font-semibold text-slate-400 mt-0.5">
                    {priceShort(line.unit_price)} × {line.quantity}
                  </p>
                  {line.note && <p className="text-[10px] text-amber-700 italic mt-0.5">↳ {line.note}</p>}
                  {line.sent_to_kitchen && (
                    <Badge tone="green" className="mt-0.5 text-[9px] px-1.5 py-0">
                      Sent to Kitchen
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="tabular text-xs font-black text-slate-900">
                    {priceShort(line.line_total)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <QtyButton
                      onClick={() => onQuantity(line, line.quantity - 1)}
                      disabled={busyItemId === line.id}
                      label="decrease"
                    >
                      <IconMinus className="size-2.5" />
                    </QtyButton>
                    <span className="tabular w-5 text-center text-[11px] font-black text-slate-800">
                      {line.quantity}
                    </span>
                    <QtyButton
                      onClick={() => onQuantity(line, line.quantity + 1)}
                      disabled={busyItemId === line.id}
                      label="increase"
                    >
                      <IconPlus className="size-2.5" />
                    </QtyButton>
                    <button
                      onClick={() => onRemove(line)}
                      disabled={busyItemId === line.id}
                      aria-label={`Remove ${line.item_name}`}
                      className="ml-0.5 rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cart Footer & Totals */}
      <div className="mt-2 border-t border-slate-200/80 pt-2 space-y-2.5">
        <Button
          variant="secondary"
          className="w-full justify-center py-2 rounded-xl border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
          onClick={onSendKot}
          loading={sendingKot}
          disabled={unsentCount === 0}
        >
          <IconKitchen className="size-4 text-slate-700" />
          {unsentCount > 0 ? `Send KOT (${unsentCount} new items)` : 'All items sent to kitchen'}
        </Button>

        <div className="flex items-baseline justify-between pt-0.5">
          <span className={Number(totals?.redeem_amount ?? 0) > 0 ? 'text-xs font-bold text-slate-400' : 'font-black text-slate-900 text-sm'}>
            Total Amount
          </span>
          <span
            className={`tabular ${
              Number(totals?.redeem_amount ?? 0) > 0
                ? 'text-sm font-bold text-slate-400'
                : 'text-xl font-black text-slate-900'
            }`}
          >
            {money(totals?.total ?? 0)}
          </span>
        </div>

        {Number(totals?.redeem_amount ?? 0) > 0 && (
          <>
            <div className="flex items-center justify-between text-xs py-0.5">
              <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/60 px-2 py-0.5 rounded-lg border border-rose-200">
                <IconSparkles className="size-3 text-rose-600" />
                Points ({totals.points_redeemed} Pts)
              </span>
              <span className="tabular font-extrabold text-rose-700">-{money(totals.redeem_amount)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
              <span className="font-black text-slate-900 text-sm">Net Payable</span>
              <span className="tabular text-2xl font-black text-rose-600">
                {money(totals.net_payable)}
              </span>
            </div>
          </>
        )}

        {/* Action CTAs */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 justify-center py-2 text-xs font-bold border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl active:scale-95 transition-all"
            onClick={onGenerateBill}
            loading={generating}
            disabled={items.length === 0}
          >
            Print Bill
          </Button>
          <Button
            size="sm"
            className="flex-1 justify-center py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            onClick={onPayBill}
            disabled={items.length === 0}
          >
            Pay & Settle
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LoyaltyRow({ totals, redeemPoints, onRedeemChange, hasCustomer }) {
  if (!totals?.loyalty_enabled) return null

  const max = totals.max_redeemable_points ?? 0
  const balance = totals.points_balance ?? 0
  const willEarn = totals.points_earned ?? 0

  if (!hasCustomer) {
    return willEarn > 0 ? (
      <p className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-xs font-semibold text-rose-800">
        Attach customer to earn <span className="font-black">+{willEarn} loyalty points</span>.
      </p>
    ) : null
  }

  if (max === 0) {
    return (
      <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-600 font-medium">
        Balance: <strong className="text-slate-900">{balance} pts</strong>
        {balance < (totals.min_redeem_points ?? 0) && (
          <> · (min {totals.min_redeem_points} pts to redeem)</>
        )}
        {willEarn > 0 && <> · earns <strong className="text-emerald-700">+{willEarn} pts</strong></>}
      </p>
    )
  }

  const applied = Number(redeemPoints) || 0

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-rose-900">
        <span className="flex items-center gap-1.5">
          <IconSparkles className="size-4 text-rose-600" />
          Redeem Loyalty Points
        </span>
        <span className="text-rose-700 font-semibold">
          {balance} available (max {max})
        </span>
      </div>

      <div className="flex gap-2">
        <input
          id="redeem"
          type="number"
          min="0"
          max={max}
          inputMode="numeric"
          value={applied || ''}
          onChange={(e) => onRedeemChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
          placeholder="0"
          className="focus:border-rose-500 focus:ring-rose-200 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold focus:ring-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onRedeemChange(applied === max ? 0 : max)}
          className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-rose-700 shadow-xs"
        >
          {applied === max ? 'Remove' : 'Max'}
        </button>
      </div>

      {willEarn > 0 && (
        <p className="mt-1.5 text-[11px] font-bold text-emerald-700">Will earn +{willEarn} points on this bill.</p>
      )}
    </div>
  )
}

function QtyButton({ children, onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="size-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function TotalRow({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular font-bold ${tone}`}>{money(value ?? 0)}</dd>
    </div>
  )
}

export function CouponInput({ subtotal, customerId, onApplyDiscount }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleApply = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setMsg(null)

    try {
      const res = await couponsService.validateCoupon(code, subtotal, customerId)
      if (res.valid) {
        setMsg({ type: 'success', text: `Coupon ${res.code} Applied: ₹${res.discount_amount} Off` })
        const percent = subtotal > 0 ? (parseFloat(res.discount_amount) / parseFloat(subtotal)) * 100 : 0
        onApplyDiscount(percent.toFixed(2))
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Invalid coupon.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5 h-full">
      <div className="mb-1 flex items-center justify-between text-xs font-extrabold text-slate-700">
        <span className="flex items-center gap-1">
          <IconReceipt className="size-3.5 text-slate-500" />
          Coupon
        </span>
      </div>
      <form onSubmit={handleApply} className="flex gap-1.5 mt-auto">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Code"
          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-1.5 font-mono text-[11px] font-bold uppercase focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-50 shrink-0"
        >
          {loading ? '...' : 'Apply'}
        </button>
      </form>
      {msg && (
        <p
          className={`mt-1 text-[9px] font-bold leading-tight ${
            msg.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}
