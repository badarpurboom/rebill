import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function VoidOrderModal({ order, table, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)

  const targetObj = order || table
  if (!targetObj) return null

  const isTakeaway = targetObj.order_type === 'TAKEAWAY' || (!targetObj.number && !targetObj.table_number)
  const label = isTakeaway
    ? `Takeaway Parcel #TK-${targetObj.id}`
    : `Table ${targetObj.number || targetObj.table_number}`

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(targetObj)
    setLoading(false)
  }

  return (
    <Modal
      open={!!targetObj}
      onClose={onClose}
      title={`Cancel ${label}`}
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-rose-800 border border-rose-200">
          <svg className="size-6 shrink-0 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs font-semibold leading-relaxed">
            Are you sure you want to cancel the active order for <strong className="font-extrabold text-rose-900">{label}</strong>?
          </div>
        </div>

        <p className="text-xs text-slate-500">
          This action will void all unbilled items on this order and remove it from active orders.
        </p>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading} size="sm">
            Keep Order
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={loading} size="sm">
            Cancel Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}
