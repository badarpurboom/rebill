import { useState } from 'react'
import { bills as billApi, PAYMENT_MODES } from '@/services/billing'
import { errorMessage } from '@/services/api'
import { money } from '@/utils/format'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ThermalBill from '@/components/print/ThermalBill'
import PrintSlipModal from '@/components/print/PrintSlipModal'

/**
 * Bill generated → collect payment → table frees up.
 *
 * Only the amount and the mode are recorded. No card digits, no UPI id — the
 * requirements are explicit about not storing them, so they are never collected.
 */
export default function PaymentModal({ bill: initialBill, onClose, onPaid }) {
  const [bill, setBill] = useState(initialBill)
  const [mode, setMode] = useState('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  const paid = bill.status === 'PAID'
  const hasRedeem = Number(bill.redeem_amount) > 0
  const due = hasRedeem ? bill.net_payable : bill.total

  const takePayment = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await billApi.pay(bill.id, mode)
      setBill(updated)
      onPaid?.(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to record payment.'))
    } finally {
      setBusy(false)
    }
  }

  if (printing) {
    return (
      <PrintSlipModal
        title={`Bill ${bill.bill_number}`}
        subtitle={`Table ${bill.table_number} · ${money(due)}`}
        onClose={() => setPrinting(false)}
      >
        <ThermalBill bill={bill} />
      </PrintSlipModal>
    )
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={paid ? '✅ Payment Complete' : `Bill ${bill.bill_number}`}
      subtitle={
        paid
          ? `Table ${bill.table_number} is now available`
          : `Table ${bill.table_number} · Payment Pending`
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
            <Button variant="secondary" onClick={() => setPrinting(true)}>
              🖨 Print
            </Button>
            <Button onClick={takePayment} loading={busy}>
              Collect {money(due)}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dl className="space-y-1 text-sm">
            <Row label="Sub Total" value={bill.subtotal} />
            {Number(bill.discount_amount) > 0 && (
              <div className="flex items-center justify-between text-xs py-1">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  🏷️ Manual Discount ({Number(bill.discount_percent).toFixed(1)}%)
                </span>
                <span className="tabular font-semibold text-emerald-700">-{money(bill.discount_amount)}</span>
              </div>
            )}
            <Row label={`CGST ${Number(bill.cgst_percent).toFixed(2)}%`} value={bill.cgst_amount} />
            <Row label={`SGST ${Number(bill.sgst_percent).toFixed(2)}%`} value={bill.sgst_amount} />
          </dl>
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-300 pt-2">
            <span className={hasRedeem ? 'text-sm text-slate-500' : 'font-semibold text-slate-900'}>
              Total
            </span>
            <span
              className={`tabular ${hasRedeem ? 'text-sm text-slate-500' : 'text-2xl font-bold text-slate-900'}`}
            >
              {money(bill.total)}
            </span>
          </div>

          {hasRedeem && (
            <>
              <div className="mt-1 flex items-center justify-between text-xs py-1">
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  ⭐ Points Redeemed ({bill.points_redeemed} Pts)
                </span>
                <span className="tabular font-semibold text-brand-700">-{money(bill.redeem_amount)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-slate-300 pt-1.5">
                <span className="font-semibold text-slate-900">Amount Payable</span>
                <span className="tabular text-2xl font-bold text-slate-900">
                  {money(bill.net_payable)}
                </span>
              </div>
            </>
          )}

          {bill.customer_name && (
            <p className="mt-2 text-xs text-slate-500">
              {bill.customer_name} · {bill.customer_phone}
              {bill.points_earned > 0 && (
                <span className="text-emerald-700">
                  {' '}
                  · {paid ? `+${bill.points_earned} points earned` : `+${bill.points_earned} points will be earned`}
                </span>
              )}
            </p>
          )}
          {bill.approved_by_name && (
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
