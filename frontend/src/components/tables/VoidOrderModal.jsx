import { useState } from 'react'

export default function VoidOrderModal({ order, table, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)

  const targetObj = order || table
  if (!targetObj) return null

  const isTakeaway = targetObj.order_type === 'TAKEAWAY' || (!targetObj.number && !targetObj.table_number)
  const label = isTakeaway
    ? `Takeaway Parcel #TK-${targetObj.id}`
    : `Table ${targetObj.number || targetObj.table_number}`

  const itemCount = targetObj.items?.length || targetObj.item_count || 0

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(targetObj)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all duration-200 scale-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-rose-600 flex items-center gap-2">
            <i className="fa-regular fa-trash-can"></i> Void Current Order?
          </h3>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="py-4 text-xs font-medium text-slate-600 space-y-2">
          <p>
            Are you sure you want to void all{' '}
            <strong className="text-slate-800 font-bold">{itemCount} items</strong> on {label}?
          </p>
          <p className="text-slate-400 text-[11px]">
            This action will notify the kitchen display and remove all running KOT tickets.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer transition"
            onClick={onClose}
            disabled={loading}
          >
            Keep Order
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Voiding...' : 'Yes, Void Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
