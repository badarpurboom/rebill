import { useEffect, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { customers as customerApi, LOYALTY_REASON_TONE } from '@/services/customers'
import { BILL_STATUS_TONE } from '@/services/billing'
import { dateTime, money } from '@/utils/format'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { Badge, PageLoader } from '@/components/ui/Misc'

const TABS = [
  { key: 'bills', label: 'Visits' },
  { key: 'loyalty', label: 'Points Ledger' },
]

export default function CustomerDetailModal({
  customerId,
  canAdjustPoints,
  onClose,
  onEdit,
  onChanged,
}) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('bills')
  const [adjusting, setAdjusting] = useState(false)

  const load = () =>
    customerApi
      .history(customerId)
      .then(setData)
      .catch((error) => toast.error(errorMessage(error, 'Failed to load customer history.')))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  if (!data) {
    return (
      <Modal open onClose={onClose} title="Customer">
        <PageLoader />
      </Modal>
    )
  }

  const person = data.customer

  if (adjusting) {
    return (
      <AdjustPointsModal
        person={person}
        onClose={() => setAdjusting(false)}
        onDone={() => {
          setAdjusting(false)
          load()
          onChanged?.()
        }}
      />
    )
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={person.name}
      subtitle={`${person.phone}${person.note ? ` · ${person.note}` : ''}`}
      footer={
        <>
          {canAdjustPoints && (
            <Button variant="secondary" onClick={() => setAdjusting(true)} className="mr-auto">
              Adjust Points
            </Button>
          )}
          <Button variant="secondary" onClick={() => onEdit(person)}>
            Edit
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visits" value={person.visit_count} />
        <Stat label="Total Spend" value={money(person.total_spent)} />
        <Stat label="Avg Bill" value={person.visit_count ? money(person.average_bill) : '—'} />
        <Stat label="Points" value={person.points_balance} tone="text-brand-700" />
      </div>

      {(person.dob || person.anniversary) && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {person.dob && <>🎂 Birthday {new Date(person.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</>}
          {person.dob && person.anniversary && ' · '}
          {person.anniversary && (
            <>💍 Anniversary {new Date(person.anniversary).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</>
          )}
        </p>
      )}

      <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-400">
              {t.key === 'bills' ? data.bills.length : data.loyalty.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'bills' ? (
        data.bills.length === 0 ? (
          <Empty text="No visits recorded yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.bills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {bill.bill_number}
                    <span className="ml-2 font-normal text-slate-400">
                      Table {bill.table_number}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">{dateTime(bill.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-semibold text-slate-900">
                    {money(bill.net_payable)}
                  </p>
                  <Badge tone={BILL_STATUS_TONE[bill.status]}>{bill.status_display}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : data.loyalty.length === 0 ? (
        <Empty text="No points transaction history." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.loyalty.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-slate-800">
                  <Badge tone={LOYALTY_REASON_TONE[entry.reason]}>{entry.reason_display}</Badge>
                  {entry.bill_number && (
                    <span className="ml-2 text-xs text-slate-500">{entry.bill_number}</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {dateTime(entry.created_at)}
                  {entry.note && ` · ${entry.note}`}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`tabular text-sm font-semibold ${
                    entry.points > 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {entry.points > 0 ? '+' : ''}
                  {entry.points}
                </p>
                <p className="tabular text-xs text-slate-400">→ {entry.balance_after}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function AdjustPointsModal({ person, onClose, onDone }) {
  const toast = useToast()
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await customerApi.adjustPoints(person.id, Number(points), note.trim())
      toast.success(`Points updated successfully for ${person.name}`)
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'Failed to adjust points.'))
    } finally {
      setBusy(false)
    }
  }

  const preview = person.points_balance + (Number(points) || 0)

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Adjust Points"
      subtitle={`${person.name} · Current balance: ${person.points_balance} points`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button form="adjust-points" type="submit" loading={busy} disabled={!points || !note.trim()}>
            Apply
          </Button>
        </>
      }
    >
      <form id="adjust-points" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="points" className="mb-1.5 block text-sm font-medium text-slate-700">
            Points Delta <span className="font-normal text-slate-400">(use negative value to deduct)</span>
          </label>
          <Input
            id="points"
            type="number"
            autoFocus
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="50 or -20"
          />
          {points !== '' && (
            <p className={`mt-1 text-xs ${preview < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              New balance: {preview} {preview < 0 && '— balance cannot be negative'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-slate-700">
            Reason <span className="text-rose-500">*</span>
          </label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Goodwill points for service issue"
          />
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This transaction will be recorded with your username in the ledger. Previous entries are permanent — adjustments add a new entry.
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`tabular mt-0.5 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function Empty({ text }) {
  return <p className="py-10 text-center text-sm text-slate-400">{text}</p>
}
