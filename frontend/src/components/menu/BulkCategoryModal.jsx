import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function BulkCategoryModal({ selectedCount, categories, onClose, onApply }) {
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!targetCategory) return
    setSubmitting(true)
    try {
      await onApply(Number(targetCategory))
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
      title="📁 Move Category"
      subtitle={`Move ${selectedCount} dishes to a new category`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!targetCategory}>
            Move to Selected Category
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Select Destination Category
          </label>
          <select
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.item_count ?? 0} existing items)
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}
