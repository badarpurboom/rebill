import { useState } from 'react'

export default function CustomItemModal({ open, onClose, onAdd }) {
  const [customName, setCustomName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customName.trim()) {
      setError('Please enter item name.')
      return
    }
    if (!unitPrice || Number(unitPrice) <= 0) {
      setError('Please enter a valid price.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await onAdd({
        custom_name: customName.trim(),
        unit_price: unitPrice.toString(),
        quantity: 1,
        portion: 'FULL',
        food_type: 'VEG',
        note: note.trim(),
      })
      // Reset form
      setCustomName('')
      setUnitPrice('')
      setNote('')
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to add custom item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all duration-200 scale-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-regular fa-plus-circle text-amber-600"></i> Add Custom Item
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs font-semibold">
          <div>
            <label className="block text-slate-600 mb-1">Item Name</label>
            <input
              id="customName"
              required
              type="text"
              placeholder="e.g. Masala Papad Special"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value)
                setError('')
              }}
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 mb-1">Price (₹)</label>
              <input
                id="customPrice"
                required
                type="number"
                min="1"
                placeholder="120"
                value={unitPrice}
                onChange={(e) => {
                  setUnitPrice(e.target.value)
                  setError('')
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium tabular"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Special Instruction</label>
              <input
                id="customNote"
                type="text"
                placeholder="Extra crispy"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add to Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
