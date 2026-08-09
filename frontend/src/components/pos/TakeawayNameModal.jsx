import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function TakeawayNameModal({ open, onClose, onSubmit }) {
  const [tagName, setTagName] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setBusy(true)
    try {
      await onSubmit(tagName.trim())
      setTagName('')
    } finally {
      setBusy(false)
    }
  }

  const handleSkip = async () => {
    setBusy(true)
    try {
      await onSubmit('')
      setTagName('')
    } finally {
      setBusy(false)
    }
  }

  const quickSuggestions = ['Token #1', 'Token #2', 'Token #3', 'Parcel A', 'Sharma Ji']

  return (
    <Modal
      open={open}
      size="sm"
      onClose={onClose}
      title="🛍️ New Takeaway Parcel"
      subtitle="Enter a name or token tag to identify this order"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Order Tag Name / Customer Name
          </label>
          <input
            type="text"
            autoFocus
            placeholder="e.g. Rahul, Token #5, Sharma Ji"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Quick Suggestion Chips */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
            Quick Suggestions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setTagName(sug)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={handleSkip} disabled={busy}>
            Skip Name
          </Button>
          <Button type="submit" loading={busy}>
            Start Takeaway
          </Button>
        </div>
      </form>
    </Modal>
  )
}
