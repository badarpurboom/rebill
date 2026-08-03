import { useState } from 'react'
import { errorMessage } from '@/services/api'
import { items as itemApi } from '@/services/menu'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const summary = await itemApi.importFile(file)
      setResult(summary)
      onImported(summary)
    } catch (err) {
      setError(errorMessage(err, 'Import failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Menu CSV / Excel import"
      subtitle="Existing items will be updated, new ones added — no duplicates created"
      footer={
        result ? (
          <Button onClick={onClose}>Ho gaya</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={upload} loading={busy} disabled={!file}>
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat value={result.created} label="Naye" tone="text-emerald-700 bg-emerald-50" />
            <Stat value={result.updated} label="Update" tone="text-brand-700 bg-brand-50" />
            <Stat value={result.skipped} label="Skip" tone="text-amber-700 bg-amber-50" />
          </div>

          {result.errors?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1.5 text-sm font-medium text-amber-900">
                {result.errors.length} row me problem thi:
              </p>
              <ul className="scroll-thin max-h-40 space-y-1 overflow-y-auto text-xs text-amber-800">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <label
            className="hover:border-brand-400 hover:bg-brand-50/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) setFile(dropped)
            }}
          >
            <span className="text-3xl" aria-hidden>
              📄
            </span>
            {file ? (
              <>
                <span className="font-medium text-slate-800">{file.name}</span>
                <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700">Choose a file or drop it here</span>
                <span className="text-xs text-slate-500">.csv, .xlsx ya .xls — max 5MB</span>
              </>
            )}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="mb-1.5 font-medium text-slate-700">Required columns:</p>
            <code className="block rounded bg-white px-2 py-1.5 text-[11px] break-all text-slate-700">
              category, name, food_type, half_price, full_price, description
            </code>
            <p className="mt-1.5">
              <span className="font-medium">category</span>, <span className="font-medium">name</span>{' '}
              aur <span className="font-medium">full_price</span> are required. Others are optional.
            </p>
            <button
              type="button"
              onClick={() => itemApi.downloadTemplate()}
              className="text-brand-600 mt-2 font-medium underline underline-offset-2 hover:text-brand-700"
            >
              ⬇ Download sample template
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function Stat({ value, label, tone }) {
  return (
    <div className={`rounded-lg px-3 py-4 ${tone}`}>
      <p className="tabular text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  )
}
