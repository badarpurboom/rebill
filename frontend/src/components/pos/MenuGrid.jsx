import { useEffect, useMemo, useRef, useState } from 'react'
import { priceShort } from '@/utils/format'
import { FoodTypeDot } from '@/components/ui/Misc'
import { Input } from '@/components/ui/Field'
import { IconSearch, IconMenu } from '@/components/ui/Icons'

const FOOD_FILTERS = [
  { value: '', label: 'All Items' },
  { value: 'VEG', label: 'Veg' },
  { value: 'NON_VEG', label: 'Non-Veg' },
]

export default function MenuGrid({ items, categories, busyVariant, onAdd, disabled }) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [foodType, setFoodType] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter(
      (item) =>
        item.is_available &&
        (!categoryId || String(item.category) === categoryId) &&
        (!foodType || item.food_type === foodType) &&
        (!needle || item.name.toLowerCase().includes(needle)),
    )
  }, [items, search, categoryId, foodType])

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes… (press '/' to focus)"
            className="pl-10 pr-4 py-2.5 rounded-2xl border-slate-200 shadow-2xs focus:border-rose-500"
          />
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">
            <IconSearch className="size-4" />
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-slate-200 p-1 text-xs text-slate-600 hover:bg-slate-300"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs">
          {FOOD_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFoodType(f.value)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                foodType === f.value
                  ? 'bg-slate-900 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.value === 'VEG' && <span className="size-2 rounded-full bg-emerald-500" />}
              {f.value === 'NON_VEG' && <span className="size-2 rounded-full bg-rose-500" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
        <CategoryChip active={categoryId === ''} onClick={() => setCategoryId('')}>
          All Dishes ({items.filter((i) => i.is_available).length})
        </CategoryChip>
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            active={categoryId === String(c.id)}
            onClick={() => setCategoryId(String(c.id))}
          >
            {c.name}
          </CategoryChip>
        ))}
      </div>

      {/* Items Grid */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <IconMenu className="size-7" />
            </div>
            <p className="text-base font-extrabold text-slate-800">No dishes found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or category filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => {
              const half = item.variants.find((v) => v.portion === 'HALF')
              const full = item.variants.find((v) => v.portion === 'FULL')
              return (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md hover:shadow-rose-500/5"
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FoodTypeDot foodType={item.food_type} />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {item.category_name || 'Main'}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold leading-snug text-slate-900 group-hover:text-rose-600 transition-colors">
                      {item.name}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {half && (
                      <PriceButton
                        label="Half"
                        price={half.price}
                        busy={busyVariant === half.id}
                        disabled={disabled}
                        onClick={() => onAdd(half)}
                      />
                    )}
                    {full && (
                      <PriceButton
                        label={half ? 'Full' : null}
                        price={full.price}
                        primary
                        busy={busyVariant === full.id}
                        disabled={disabled}
                        onClick={() => onAdd(full)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold transition-all duration-150 ${
        active
          ? 'bg-rose-600 text-white font-extrabold shadow-md shadow-rose-600/20'
          : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function PriceButton({ label, price, primary, busy, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`tabular flex-1 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50
        ${
          primary
            ? 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 hover:shadow-md hover:shadow-rose-600/20'
            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
        }`}
    >
      {busy ? (
        '…'
      ) : (
        <div className="flex items-center justify-center gap-1">
          {label && <span className="text-[10px] opacity-80 uppercase font-bold">{label}</span>}
          <span>{priceShort(price)}</span>
        </div>
      )}
    </button>
  )
}
