import { useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { bills as billApi } from '@/services/billing'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function ImportBillsModal({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const toast = useToast()

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const res = await billApi.importFile(file)
      setResult(res)
      toast.success(`Imported ${res.created} bills successfully!`)
      onDone?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to import bills file.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="📤 Import Historical Bills CSV" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-500 font-semibold">
          Upload a CSV or Excel file containing past bills to import historical sales records into ReBill.
        </p>

        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-xs font-bold text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
          />
          {file && (
            <p className="mt-2 text-xs font-bold text-emerald-700">
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>

        {result && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <p className="font-extrabold text-slate-900">
              Import Completed: <span className="text-emerald-700">{result.created} Created</span> · <span className="text-amber-700">{result.skipped} Skipped</span>
            </p>
            {result.errors?.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-rose-600 font-medium">
                {result.errors.map((err, idx) => (
                  <p key={idx}>Row {err.row}: {err.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!file || loading} className="bg-rose-600 text-white font-bold">
            {loading ? 'Importing…' : 'Start Bill Import'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
