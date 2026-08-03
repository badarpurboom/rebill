import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { customers as customerApi } from '@/services/customers'
import { money } from '@/utils/format'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Misc'
import CustomerFormModal from '@/components/customers/CustomerFormModal'
import CustomerDetailModal from '@/components/customers/CustomerDetailModal'

export default function Customers() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(
    async (term) => {
      try {
        const data = await customerApi.list(term ? { search: term } : undefined)
        setRows(data.results)
        setCount(data.count)
      } catch (error) {
        toast.error(errorMessage(error, 'Failed to load customers.'))
        setRows([])
      }
    },
    [toast],
  )

  useEffect(() => {
    const timer = setTimeout(() => load(search.trim()), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, load])

  if (rows === null) return <PageLoader label="Loading customer directory…" />

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {count} Profiles
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Loyalty point balances, visit frequencies, and Lifetime Value (LTV) insights
          </p>
        </div>

        <Button onClick={() => setEditing({})} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20">
          + Add New Customer
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name or 10-digit phone number…"
          className="pl-11 pr-4 py-3 rounded-2xl border-slate-200 focus:border-rose-500 shadow-xs text-sm font-semibold"
        />
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 text-lg">
          🔍
        </span>
      </div>

      {/* Customers Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon="👥"
          title={search ? 'No matching customers found' : 'No registered customers yet'}
          hint={
            search
              ? 'Try searching for a different name or phone number.'
              : 'Register customers during POS billing to earn loyalty points.'
          }
          action={
            <Button onClick={() => setEditing({})} className="bg-rose-600 text-white font-bold rounded-xl">
              + Register First Customer
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Customer Name &amp; Phone</th>
                <th className="w-24 px-5 py-3.5 text-right">Total Visits</th>
                <th className="w-32 px-5 py-3.5 text-right">Lifetime Spend</th>
                <th className="w-28 px-5 py-3.5 text-right">Avg Bill</th>
                <th className="w-28 px-5 py-3.5 text-right">Loyalty Points</th>
                <th className="w-28 px-5 py-3.5 text-right">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => setViewing(person)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50/90 ${
                    person.is_active ? '' : 'opacity-40 bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-bold text-slate-900 hover:text-rose-600 transition-colors">
                        {person.name}
                        {!person.is_active && (
                          <Badge tone="slate" className="ml-2">
                            Inactive
                          </Badge>
                        )}
                      </p>
                      <p className="tabular text-xs font-semibold text-slate-400 mt-0.5">{person.phone}</p>
                    </div>
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-bold text-slate-700">
                    {person.visit_count}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-extrabold text-slate-900">
                    {money(person.total_spent)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-semibold text-slate-500">
                    {person.visit_count ? money(person.average_bill) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {person.points_balance > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700 border border-rose-200">
                        ⭐ {person.points_balance} pts
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400">
                    {person.days_since_visit === null
                      ? '—'
                      : person.days_since_visit === 0
                        ? 'Today'
                        : `${person.days_since_visit}d ago`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {editing && (
        <CustomerFormModal
          customer={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(saved, wasNew) => {
            setEditing(null)
            toast.success(`${saved.name} ${wasNew ? 'registered' : 'updated'} successfully`)
            load(search.trim())
          }}
        />
      )}

      {/* Detail Ledger Modal */}
      {viewing && (
        <CustomerDetailModal
          customerId={viewing.id}
          canAdjustPoints={isOwner}
          onClose={() => setViewing(null)}
          onEdit={(person) => {
            setViewing(null)
            setEditing(person)
          }}
          onChanged={() => load(search.trim())}
        />
      )}
    </div>
  )
}
