import { forwardRef } from 'react'
import { money } from '@/utils/format'

/**
 * Customer bill for a 58/80mm thermal roll.
 *
 * Every number comes from the Bill record, never recomputed — a reprint months
 * later must match the paper the customer walked out with.
 */
const ThermalBill = forwardRef(function ThermalBill({ bill }, ref) {
  if (!bill) return null

  const hasRedeem = Number(bill.redeem_amount) > 0
  const stamp = new Date(bill.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div ref={ref} className="thermal-slip font-mono text-black">
      <div className="text-center">
        <p className="text-base font-bold uppercase">{bill.restaurant_name}</p>
        {bill.restaurant_address && (
          <p className="text-[11px] whitespace-pre-line">{bill.restaurant_address}</p>
        )}
        {bill.gstin && <p className="text-[11px]">GSTIN: {bill.gstin}</p>}
      </div>

      <Divider />

      <div className="flex justify-between text-[11px]">
        <span className="font-bold">Bill: {bill.bill_number}</span>
        <span>Table {bill.table_number}</span>
      </div>
      <div className="flex justify-between text-[11px]">
        <span>{stamp}</span>
        <span>By: {bill.created_by_name}</span>
      </div>
      {bill.customer_name && (
        <p className="text-[11px]">
          Customer: {bill.customer_name} ({bill.customer_phone})
        </p>
      )}

      <Divider />

      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="pb-1 text-left">Item</th>
            <th className="w-8 pb-1 text-center">Qty</th>
            <th className="w-14 pb-1 text-right">Rate</th>
            <th className="w-16 pb-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((line) => (
            <tr key={line.id} className="align-top">
              <td className="py-0.5">
                {line.item_name}
                {line.portion === 'HALF' && <span className="text-[10px]"> (H)</span>}
              </td>
              <td className="py-0.5 text-center">{line.quantity}</td>
              <td className="py-0.5 text-right">{Number(line.unit_price).toFixed(0)}</td>
              <td className="py-0.5 text-right">{Number(line.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Divider />

      <Row label="Sub Total" value={bill.subtotal} />
      {Number(bill.discount_amount) > 0 && (
        <Row label={`🏷️ Discount (${Number(bill.discount_percent).toFixed(1)}%)`} value={`-${bill.discount_amount}`} />
      )}
      <Row label="Taxable Amount" value={bill.taxable_amount} />
      <Row label={`CGST @ ${Number(bill.cgst_percent).toFixed(2)}%`} value={bill.cgst_amount} />
      <Row label={`SGST @ ${Number(bill.sgst_percent).toFixed(2)}%`} value={bill.sgst_amount} />

      <Divider />

      <div className={`flex justify-between ${hasRedeem ? 'text-[11px]' : 'text-base font-bold'}`}>
        <span>{hasRedeem ? 'Bill Total' : 'TOTAL'}</span>
        <span className="tabular">{money(bill.total)}</span>
      </div>

      {hasRedeem && (
        <>
          <Row label={`⭐ Points Used (${bill.points_redeemed} Pts)`} value={`-${bill.redeem_amount}`} />
          <div className="mt-1 flex justify-between border-t border-dashed border-black pt-1 text-base font-bold">
            <span>PAYABLE</span>
            <span className="tabular">{money(bill.net_payable)}</span>
          </div>
        </>
      )}

      {bill.payment_mode && (
        <p className="mt-1 text-[11px]">Paid by: {bill.payment_mode_display}</p>
      )}
      {bill.approved_by_name && (
        <p className="text-[10px]">Discount approved by: {bill.approved_by_name}</p>
      )}
      {bill.status === 'CANCELLED' && (
        <p className="mt-1 text-center text-[11px] font-bold">
          *** CANCELLED *** {bill.cancel_reason}
        </p>
      )}

      <Divider />

      {bill.customer_name && bill.points_earned > 0 && (
        <p className="text-center text-[11px]">
          {bill.points_earned} loyalty points earned on this bill 🎁
        </p>
      )}
      <p className="text-center text-[11px]">Thank you! Visit us again 🙏</p>
    </div>
  )
})

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span>{label}</span>
      <span className="tabular">{Number(value).toFixed(2)}</span>
    </div>
  )
}

function Divider() {
  return <p className="my-1.5 overflow-hidden text-[10px] leading-none">{'-'.repeat(64)}</p>
}

export default ThermalBill
