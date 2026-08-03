import { useEffect, useState } from 'react'
import { errorMessage } from '@/services/api'
import { customers as customerApi } from '@/services/customers'
import { money } from '@/utils/format'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { Badge, Spinner } from '@/components/ui/Misc'
import CustomerFormModal from './CustomerFormModal'

/**
 * Phone-first customer picker for the POS.
 */
export default function CustomerPickerModal({ attached, onClose, onPick, onDetach }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    const digits = query.replace(/\D/g, '')
    const isPhone = digits.length >= 4
    const isName = query.trim().length >= 2 && !isPhone

    if (!isPhone && !isName) {
      setResults([])
      return
    }

    setSearching(true)
    const timer = setTimeout(() => {
      const request = isPhone
        ? customerApi.lookup(digits).then((d) => (d.exact ? [d.exact] : d.matches))
        : customerApi.list({ search: query.trim(), active: 'true' }).then((d) => d.results)

      request
        .then(setResults)
        .catch((err) => setError(errorMessage(err, 'Search failed.')))
        .finally(() => setSearching(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (registering) {
    return (
      <CustomerFormModal
        prefillPhone={query.replace(/\D/g, '').slice(-10)}
        onClose={() => setRegistering(false)}
        onSaved={(saved) => onPick(saved)}
      />
    )
  }

  const digits = query.replace(/\D/g, '')
  const canRegister = digits.length === 10

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Attach Customer"
      subtitle="Search by phone number or name"
      footer={
        <>
          {attached && (
            <Button variant="secondary" onClick={onDetach} className="mr-auto">
              Detach
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => setRegistering(true)}>+ New Customer</Button>
        </>
      }
    >
      <div className="space-y-3">
        {attached && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-sm font-medium text-emerald-900">
              Currently Attached: {attached.name}
            </p>
            <p className="text-xs text-emerald-700">
              {attached.phone} · {attached.points_balance} points
            </p>
          </div>
        )}

        <div className="relative">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="9876543210 or Ankit"
            className="pl-9"
          />
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>

        {searching && (
          <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
            <Spinner className="size-4" /> Searching…
          </p>
        )}

        {!searching && results.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {results.map((person) => (
              <li key={person.id}>
                <button
                  onClick={() => onPick(person)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{person.name}</p>
                    <p className="text-xs text-slate-500">
                      {person.phone} · {person.visit_count} visits · {money(person.total_spent)}
                    </p>
                  </div>
                  {person.points_balance > 0 && (
                    <Badge tone="brand">{person.points_balance} pts</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center">
            <p className="text-sm text-slate-600">No customer found</p>
            {canRegister ? (
              <Button size="sm" className="mt-2" onClick={() => setRegistering(true)}>
                Register {digits.slice(-10)}
              </Button>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Enter full 10-digit phone number</p>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
