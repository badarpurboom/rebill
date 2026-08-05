import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function TransferModal({ tables, sourceTable, onClose, onTransfer }) {
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset selection whenever the sourceTable changes (new transfer opened)
  useEffect(() => {
    setSelectedId('')
  }, [sourceTable?.id])

  // Only show AVAILABLE tables, exclude the current table just in case.
  const availableTables = tables.filter((t) => t.status === 'AVAILABLE' && t.id !== sourceTable?.id)

  const handleConfirm = async () => {
    if (!selectedId) return
    setSaving(true)
    await onTransfer(sourceTable.id, parseInt(selectedId, 10))
    setSaving(false)
  }

  if (!sourceTable) return null


  return (
    <Modal title={`Transfer Table ${sourceTable.number}`} open={!!sourceTable} onClose={onClose} maxWidth="sm">
      <div className="p-5">
        <p className="text-sm font-semibold text-slate-600 mb-4">
          Select an empty table to transfer the active order to:
        </p>

        {availableTables.length === 0 ? (
          <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-sm font-semibold text-amber-700">
            No empty tables available to transfer to.
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="" disabled>Select target table...</option>
              {availableTables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} ({t.seats} Seats)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={saving}
            disabled={!selectedId || availableTables.length === 0}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Confirm Transfer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
