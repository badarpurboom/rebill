import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function BulkPriceModal({ selectedCount, onClose, onApply }) {
  const [mode, setMode] = useState('percent') // 'percent' or 'flat'
  const [direction, setDirection] = useState('increase') // 'increase' or 'decrease'
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const num = Number(value)
    if (isNaN(num) || num <= 0) return

    setSubmitting(true)
    try {
      const finalValue = direction === 'increase' ? num : -num
      await onApply({ mode, value: finalValue })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="💰 Bulk Price Adjustment"
      subtitle={`Update prices for ${selectedCount} selected dishes`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!value || Number(value) <= 0}>
            Apply to {selectedCount} Dishes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Direction: Increase vs Decrease */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Adjustment Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('increase')}
              className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                direction === 'increase'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              📈 Price Hike (+ Increase)
            </button>
            <button
              type="button"
              onClick={() => setDirection('decrease')}
              className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                direction === 'decrease'
                  ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              📉 Discount (- Decrease)
            </button>
          </div>
        </div>

        {/* Mode: Percentage vs Flat ₹ */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Calculation Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('percent')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                mode === 'percent'
                  ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              % Percentage (e.g. 10%)
            </button>
            <button
              type="button"
              onClick={() => setMode('flat')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                mode === 'flat'
                  ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              ₹ Flat Amount (e.g. ₹20)
            </button>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            {mode === 'percent' ? 'Percentage Value (%)' : 'Amount in Rupees (₹)'}
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'percent' ? 'e.g. 10' : 'e.g. 20'}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              {mode === 'percent' ? '%' : '₹'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            This will adjust both Half & Full prices of all {selectedCount} selected dishes.
          </p>
        </div>
      </form>
    </Modal>
  )
}
