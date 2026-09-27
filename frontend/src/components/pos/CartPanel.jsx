import { useMemo, useState } from 'react'
import { money, priceShort } from '@/utils/format'
import { couponsService } from '@/services/coupons'

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
  const unsentCount = items.filter((l) => !l.sent_to_kitchen && !l.kot).length
  const totalCount = items.reduce((acc, curr) => acc + (curr.quantity || 1), 0)

  // Subtotal, taxes, roundoff calculations
  const rawSubtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + Number(curr.unit_price) * curr.quantity, 0)
  }, [items])

  const taxAmount = useMemo(() => {
    if (totals?.cgst_amount || totals?.sgst_amount) {
      return Number(totals.cgst_amount || 0) + Number(totals.sgst_amount || 0)
    }
    return Math.round(rawSubtotal * 0.05 * 100) / 100 // 5% GST fallback
  }, [rawSubtotal, totals])

  const totalCalculated = useMemo(() => {
    if (totals?.net_payable) return Number(totals.net_payable)
    if (totals?.total) return Number(totals.total)
    return Math.round(rawSubtotal + taxAmount)
  }, [rawSubtotal, taxAmount, totals])

  const roundOff = useMemo(() => {
    const rawSum = rawSubtotal + taxAmount
    return totalCalculated - rawSum
  }, [rawSubtotal, taxAmount, totalCalculated])

  const [activeItemId, setActiveItemId] = useState(null)
  const [deletingIds, setDeletingIds] = useState(() => new Set())

  const handleRemoveWithAnim = (line) => {
    setDeletingIds((prev) => {
      const next = new Set(prev)
      next.add(line.id)
      return next
    })
    setTimeout(() => {
      onRemove(line)
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(line.id)
        return next
      })
    }, 250)
  }

  const handleQuantityWithAnim = (line, newQty) => {
    if (newQty < 1) {
      handleRemoveWithAnim(line)
    } else {
      onQuantity(line, newQty)
    }
  }

  return (
    <aside
      className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between h-full min-h-0 overflow-hidden transition-colors duration-300"
      data-purpose="order-summary-sidebar"
      id="billingSidebar"
    >
      {/* Header: Count and Custom Item */}
      <div className="shrink-0 flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-600 transition-all duration-150 inline-block badge-pop"
          id="cartItemsBadge"
        >
          {totalCount} {totalCount === 1 ? 'item' : 'items'}
        </span>

        <button
          type="button"
          onClick={onAddCustomItem}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50/80 hover:bg-amber-100/70 border border-amber-200/80 px-2.5 py-0.5 rounded-xl transition active:scale-95 duration-150 cursor-pointer"
          id="customItemBtn"
        >
          <i className="fa-regular fa-plus-circle text-amber-600 text-xs"></i>
          Custom Item
        </button>
      </div>

      {/* Order Items List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto pr-1 my-1 transition-all rounded-xl scroll-thin"
        id="cartItemsList"
      >
        {items.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <i className="fa-solid fa-cart-shopping text-2xl mb-1.5 text-slate-300 block"></i>
            <p className="text-xs font-semibold text-slate-600">No items added to this order</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Select dishes from the menu catalog</p>
          </div>
        ) : (
          items.map((line) => {
            const lineTotal = Number(line.unit_price) * line.quantity
            const isHovered = activeItemId === line.id
            const isDeleting = deletingIds.has(line.id)
            return (
              <div
                key={line.id}
                id={`cart-row-${line.id}`}
                className={`cart-row-container mb-1.5 ${isDeleting ? 'is-deleting' : ''}`}
              >
                <div className="cart-row-inner">
                  <div
                    onMouseEnter={() => setActiveItemId(line.id)}
                    onMouseLeave={() => setActiveItemId(null)}
                    onClick={() => setActiveItemId(isHovered ? null : line.id)}
                    className={`pos-cart-item rounded-xl border border-slate-200/90 bg-white px-3 py-2 sm:py-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                      isHovered ? 'is-expanded' : ''
                    }`}
                    data-purpose="order-item"
                  >
                    {/* Default Line: Name + (Half) + x Qty --------- Price & Quick Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none truncate">
                          {line.item_name}
                        </h3>
                        {line.portion === 'HALF' && (
                          <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 rounded uppercase">
                            Half
                          </span>
                        )}
                        {(line.sent_to_kitchen || line.kot) && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded shrink-0">
                            ✓
                          </span>
                        )}
                        <span className="text-xs font-black text-rose-600 bg-rose-50/80 border border-rose-100 px-1.5 py-0.2 rounded tabular shrink-0">
                          x {line.quantity}
                        </span>
                        {line.note && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded truncate max-w-[90px]">
                            {line.note}
                          </span>
                        )}
                      </div>

                      {/* Right side: Total Price + Quick Delete button */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm sm:text-[15px] font-black text-slate-900 tabular">
                          ₹{lineTotal.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          title="Delete item"
                          disabled={busyItemId === line.id || isDeleting}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveWithAnim(line)
                          }}
                          className="w-6 h-6 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition active:scale-90 cursor-pointer disabled:opacity-30"
                        >
                          <i className="fa-regular fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>

                    {/* Hover / Expanded Controls */}
                    <div className="pos-cart-controls flex items-center justify-between">
                      {/* Left: Delete Button */}
                      <button
                        type="button"
                        disabled={busyItemId === line.id || isDeleting}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveWithAnim(line)
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 active:scale-95 transition-all cursor-pointer disabled:opacity-40 px-2.5 py-1 rounded-xl border border-rose-200/80 shadow-2xs"
                      >
                        <i className="fa-solid fa-trash-can text-xs text-rose-600"></i>
                        <span>Delete</span>
                      </button>

                      {/* Middle: Unit Rate */}
                      <span className="text-[11px] font-semibold text-slate-400 tabular hidden sm:inline">
                        ₹{priceShort(line.unit_price)} each
                      </span>

                      {/* Right: Stepper Controls */}
                      <div className="inline-flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-0.5 shadow-2xs">
                        <button
                          type="button"
                          disabled={busyItemId === line.id || isDeleting}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuantityWithAnim(line, line.quantity - 1)
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200/70 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-sm font-black transition active:scale-90 cursor-pointer disabled:opacity-40 shadow-2xs"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-black text-slate-900 select-none tabular text-xs">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={busyItemId === line.id || isDeleting}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuantityWithAnim(line, line.quantity + 1)
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-rose-600 text-sm font-black transition active:scale-90 cursor-pointer disabled:opacity-40 shadow-xs"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* KOT Sync Indicator Pill / Action Button */}
      {items.length > 0 && (
        <div className="shrink-0 my-1.5" id="kotStatusPill">
          {unsentCount === 0 ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs transition duration-200">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                <span>Kitchen Synced (All Sent)</span>
              </div>
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                Synced
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSendKot}
              disabled={sendingKot}
              className="w-full flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-600/20 rounded-xl px-3.5 py-2.5 text-sm font-extrabold transition active:scale-[0.98] duration-150 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 text-white font-black text-xs sm:text-sm">
                <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping"></span>
                <i className="fa-solid fa-fire-burner text-amber-100 text-sm"></i>
                <span>Send KOT to Kitchen ({unsentCount} new)</span>
              </div>
              <span className="text-xs font-black text-amber-900 bg-white hover:bg-amber-50 px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                {sendingKot ? 'Sending...' : 'Send Now ➔'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Calculation Breakdown & Bottom Buttons */}
      <div className="shrink-0 pt-2 border-t border-slate-100 mt-auto">
        {/* Total Amount */}
        <div className="flex items-baseline justify-between pt-0.5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
              Total Amount
            </p>
          </div>
          <div
            className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular"
            id="totalAmountVal"
          >
            ₹{totalCalculated.toFixed(2)}
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="grid grid-cols-5 gap-2 mt-2.5">
          <button
            type="button"
            onClick={onGenerateBill}
            disabled={items.length === 0 || generating}
            className="col-span-2 py-2.5 px-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-95 duration-150 shadow-sm cursor-pointer disabled:opacity-50"
            id="printBillBtn"
          >
            <i className="fa-solid fa-print text-xs"></i>
            Print Bill
          </button>
          <button
            type="button"
            onClick={onPayBill}
            disabled={items.length === 0}
            className="col-span-3 py-2.5 px-3 rounded-xl bg-brand hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition duration-150 shadow-md shadow-rose-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            id="paySettleBtn"
          >
            <i className="fa-solid fa-bolt text-xs"></i>
            Pay & Settle
          </button>
        </div>
      </div>
    </aside>
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
          <i className="fa-solid fa-wand-magic-sparkles text-rose-600"></i>
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
          className="focus:border-rose-500 focus:ring-rose-200 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold focus:ring-2 focus:outline-none tabular"
        />
        <button
          type="button"
          onClick={() => onRedeemChange(applied === max ? 0 : max)}
          className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-rose-700 shadow-xs cursor-pointer"
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
          <i className="fa-solid fa-receipt text-slate-500"></i>
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
          className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-50 shrink-0 cursor-pointer"
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

export function DiscountInput({ discount, onChangeDiscount, subtotal = 0 }) {
  const PRESET_PERCENTAGES = [5, 10, 15, 20]
  const numSubtotal = Number(subtotal) || 0
  const numDiscount = Number(discount) || 0
  const discountAmount = (numSubtotal * numDiscount) / 100
  const netAfterDiscount = Math.max(0, numSubtotal - discountAmount)

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5 h-full">
      <div className="mb-1 flex items-center justify-between text-xs font-extrabold text-slate-700">
        <span className="flex items-center gap-1">
          🏷️ Direct Discount (%)
        </span>
        {discount && Number(discount) > 0 && (
          <button
            type="button"
            onClick={() => onChangeDiscount('')}
            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
          >
            Clear ({discount}%)
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-auto">
        <div className="relative flex-1 min-w-0">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={discount}
            onChange={(e) => onChangeDiscount(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 pr-6 font-mono text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none tabular"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
            %
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex gap-1 shrink-0">
          {PRESET_PERCENTAGES.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onChangeDiscount(String(pct))}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-black transition cursor-pointer ${
                String(discount) === String(pct)
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {numDiscount > 0 && numSubtotal > 0 && (
        <div className="mt-1.5 flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-0.5 border border-emerald-200/60 text-[10px]">
          <span className="font-semibold text-emerald-800">
            Save ₹{discountAmount.toFixed(2)} ({numDiscount}%)
          </span>
          <span className="font-bold text-emerald-900 tabular">
            New: ₹{netAfterDiscount.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}

