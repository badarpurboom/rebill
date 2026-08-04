import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { categories as categoryApi, items as itemApi } from '@/services/menu'
import { priceShort } from '@/utils/format'
import Button from '@/components/ui/Button'
import { EmptyState, FoodTypeDot, Badge, PageLoader, Toggle } from '@/components/ui/Misc'
import ItemFormModal from '@/components/menu/ItemFormModal'
import ImportModal from '@/components/menu/ImportModal'

export default function MenuManagement() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [cats, setCats] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [foodType, setFoodType] = useState('')
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const searchRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [cl, il] = await Promise.all([categoryApi.list(), itemApi.list()])
      setCats(cl)
      setRows(il)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load menu.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const fn = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (item) =>
        (!categoryId || String(item.category) === categoryId) &&
        (!foodType || item.food_type === foodType) &&
        (!q || item.name.toLowerCase().includes(q)),
    )
  }, [rows, search, categoryId, foodType])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of visible) {
      if (!map.has(item.category_name)) map.set(item.category_name, [])
      map.get(item.category_name).push(item)
    }
    return [...map.entries()]
  }, [visible])

  const outOfStock = rows.filter((r) => !r.is_available).length

  const toggleStock = async (item) => {
    setBusyId(item.id)
    setRows((c) => c.map((r) => r.id === item.id ? { ...r, is_available: !r.is_available } : r))
    try {
      const data = await itemApi.toggleStock(item.id)
      setRows((c) => c.map((r) => r.id === item.id ? { ...r, is_available: data.is_available } : r))
      toast.success(`${item.name} is now ${data.is_available ? 'In Stock' : 'Out of Stock'}`)
    } catch (err) {
      setRows((c) => c.map((r) => r.id === item.id ? { ...r, is_available: item.is_available } : r))
      toast.error(errorMessage(err, 'Failed to update stock.'))
    } finally {
      setBusyId(null)
    }
  }

  const clearMenuCatalog = async () => {
    if (!window.confirm('WARNING: All menu items and categories will be permanently deleted! Are you sure?')) return
    try {
      await itemApi.clearAll()
      setCats([])
      setRows([])
      toast.success('All menu items deleted. You can now upload your own menu.')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to clear menu.'))
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await itemApi.remove(item.id)
      setRows((c) => c.filter((r) => r.id !== item.id))
      toast.success(`${item.name} deleted.`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete item.'))
    }
  }

  if (loading) return <PageLoader label="Loading menu catalog…" />

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Menu Catalog</h1>
              <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-black text-rose-600">
                {rows.length} Items
              </span>
              {outOfStock > 0 && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-600">
                  {outOfStock} Out of Stock
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {cats.length} Categories · Half / Full Price Variants · Live Stock Control
            </p>
          </div>
          {isOwner && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={clearMenuCatalog}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                title="Delete all menu items and categories"
              >
                🗑️ Clear All Menu
              </button>
              <button
                onClick={() => itemApi.exportFile()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                📤 Bulk Import
              </button>
              <button
                onClick={() => setEditing({})}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-colors"
              >
                + New Dish
              </button>
            </div>
          )}
        </div>
      </div>


      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">

          {/* Search input */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes by name…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
              >×</button>
            )}
          </div>

          {/* Category dropdown */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all w-36 shrink-0 cursor-pointer"
          >
            <option value="">All Categories</option>
            {cats.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>

          {/* Veg type pills */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
            {[
              { value: '', label: 'All' },
              { value: 'VEG', label: '🟢 Veg' },
              { value: 'NON_VEG', label: '🔴 Non-Veg' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFoodType(f.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                  foodType === f.value
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Result count */}
          {search || categoryId || foodType ? (
            <span className="shrink-0 text-xs font-bold text-slate-400 whitespace-nowrap">
              {visible.length} results
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Category Sections ── */}
      {visible.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No dishes found"
          hint={rows.length === 0 ? 'Menu is empty. Add a dish or import from CSV.' : 'Try adjusting your search or filters.'}
          action={
            isOwner && rows.length === 0 ? (
              <button
                onClick={() => setEditing({})}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-black text-white"
              >
                + Add First Dish
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([catName, items]) => (
            <section key={catName}>
              {/* Category header */}
              <div className="mb-2.5 flex items-center gap-2">
                <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  {catName}
                </h2>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-500">
                  {items.length}
                </span>
                <div className="flex-1 border-t border-slate-100" />
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                      <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Dish Name
                      </th>
                      <th className="w-28 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Half
                      </th>
                      <th className="w-28 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Full
                      </th>
                      <th className="w-32 px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        In Stock
                      </th>
                      {isOwner && (
                        <th className="w-20 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const half = item.variants?.find((v) => v.portion === 'HALF')
                      const full = item.variants?.find((v) => v.portion === 'FULL')
                      return (
                        <tr
                          key={item.id}
                          className={`group transition-colors hover:bg-slate-50/70 ${
                            !item.is_available ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <FoodTypeDot foodType={item.food_type} />
                              <div>
                                <p className={`font-extrabold ${item.is_available ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Half */}
                          <td className="tabular px-5 py-3.5 text-right text-sm font-semibold text-slate-500">
                            {half ? priceShort(half.price) : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Full */}
                          <td className="tabular px-5 py-3.5 text-right text-sm font-black text-slate-900">
                            {full ? priceShort(full.price) : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Stock */}
                          <td className="px-5 py-3.5 text-center">
                            {isOwner ? (
                              <div className="flex justify-center">
                                <Toggle
                                  checked={item.is_available}
                                  disabled={busyId === item.id}
                                  onChange={() => toggleStock(item)}
                                  label={item.name}
                                />
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <Badge tone={item.is_available ? 'green' : 'red'}>
                                  {item.is_available ? 'In Stock' : 'Out of Stock'}
                                </Badge>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          {isOwner && (
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditing(item)}
                                  title="Edit"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => remove(item)}
                                  title="Delete"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {editing && (
        <ItemFormModal
          item={editing.id ? editing : null}
          categories={cats}
          onClose={() => setEditing(null)}
          onSaved={(saved, wasNew) => {
            setRows((c) => wasNew ? [...c, saved] : c.map((r) => r.id === saved.id ? saved : r))
            setEditing(null)
            toast.success(`${saved.name} ${wasNew ? 'added' : 'updated'}.`)
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(summary) => {
            load()
            toast.success(`Import complete — ${summary.created} added, ${summary.updated} updated`)
          }}
        />
      )}
    </div>
  )
}
