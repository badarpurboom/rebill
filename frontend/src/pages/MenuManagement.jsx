import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { categories as categoryApi, items as itemApi } from '@/services/menu'
import { money, priceShort } from '@/utils/format'
import Button from '@/components/ui/Button'
import { EmptyState, FoodTypeDot, Badge, PageLoader, Toggle } from '@/components/ui/Misc'
import ItemFormModal from '@/components/menu/ItemFormModal'
import ImportModal from '@/components/menu/ImportModal'
import CategoryManagerModal from '@/components/menu/CategoryManagerModal'
import BulkPriceModal from '@/components/menu/BulkPriceModal'
import BulkCategoryModal from '@/components/menu/BulkCategoryModal'

export default function MenuManagement() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [cats, setCats] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL') // 'ALL' or category.id
  const [foodType, setFoodType] = useState('ALL') // 'ALL', 'VEG', 'NON_VEG'
  const [stockFilter, setStockFilter] = useState('ALL') // 'ALL', 'IN_STOCK', 'OUT_OF_STOCK'
  const [sortBy, setSortBy] = useState('DEFAULT') // 'DEFAULT', 'NAME_ASC', 'NAME_DESC', 'PRICE_ASC', 'PRICE_DESC'
  const [viewMode, setViewMode] = useState('table') // 'table' or 'grid'

  // Modals & Drawers
  const [editingItem, setEditingItem] = useState(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false)

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Inline Price Editing State: { [itemId]: { FULL: '260', HALF: '150' } }
  const [inlinePriceEdit, setInlinePriceEdit] = useState(null) // { itemId, portion, value }

  const searchRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [cl, il] = await Promise.all([categoryApi.list(), itemApi.list()])
      setCats(cl)
      setRows(il)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load menu catalog.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const fn = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // KPI Calculations
  const stats = useMemo(() => {
    const totalItems = rows.length
    const outOfStockCount = rows.filter((r) => !r.is_available).length
    const inStockCount = totalItems - outOfStockCount
    const vegCount = rows.filter((r) => r.food_type === 'VEG').length
    const nonVegCount = rows.filter((r) => r.food_type === 'NON_VEG').length
    
    let totalPrice = 0
    let priceItemCount = 0
    rows.forEach((r) => {
      const full = r.variants?.find((v) => v.portion === 'FULL')
      if (full && Number(full.price) > 0) {
        totalPrice += Number(full.price)
        priceItemCount++
      }
    })
    const avgPrice = priceItemCount > 0 ? (totalPrice / priceItemCount).toFixed(0) : 0

    return {
      totalItems,
      outOfStockCount,
      inStockCount,
      vegCount,
      nonVegCount,
      avgPrice,
      activeCategories: cats.filter((c) => c.is_active).length,
    }
  }, [rows, cats])

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    let res = rows.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL' && String(item.category) !== String(selectedCategory)) {
        return false
      }
      // Food Type filter
      if (foodType !== 'ALL' && item.food_type !== foodType) {
        return false
      }
      // Stock filter
      if (stockFilter === 'IN_STOCK' && !item.is_available) return false
      if (stockFilter === 'OUT_OF_STOCK' && item.is_available) return false

      // Search query
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesDesc = (item.description || '').toLowerCase().includes(q)
        const matchesCat = (item.category_name || '').toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesCat) return false
      }
      return true
    })

    // Sorting
    if (sortBy === 'NAME_ASC') {
      res.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'NAME_DESC') {
      res.sort((a, b) => b.name.localeCompare(a.name))
    } else if (sortBy === 'PRICE_ASC') {
      res.sort((a, b) => {
        const pA = Number(a.variants?.find((v) => v.portion === 'FULL')?.price || 0)
        const pB = Number(b.variants?.find((v) => v.portion === 'FULL')?.price || 0)
        return pA - pB
      })
    } else if (sortBy === 'PRICE_DESC') {
      res.sort((a, b) => {
        const pA = Number(a.variants?.find((v) => v.portion === 'FULL')?.price || 0)
        const pB = Number(b.variants?.find((v) => v.portion === 'FULL')?.price || 0)
        return pB - pA
      })
    }

    return res
  }, [rows, search, selectedCategory, foodType, stockFilter, sortBy])

  // Grouped by Category for display
  const groupedItems = useMemo(() => {
    const map = new Map()
    for (const item of filteredItems) {
      const catName = item.category_name || 'Uncategorized'
      if (!map.has(catName)) map.set(catName, [])
      map.get(catName).push(item)
    }
    return [...map.entries()]
  }, [filteredItems])

  // Toggle single item stock
  const handleToggleStock = async (item) => {
    setBusyId(item.id)
    const nextState = !item.is_available
    setRows((curr) => curr.map((r) => (r.id === item.id ? { ...r, is_available: nextState } : r)))
    try {
      const updated = await itemApi.toggleStock(item.id)
      setRows((curr) => curr.map((r) => (r.id === item.id ? updated : r)))
      toast.success(`${item.name} marked ${nextState ? 'In Stock' : 'Out of Stock'}`)
    } catch (err) {
      setRows((curr) => curr.map((r) => (r.id === item.id ? { ...r, is_available: !nextState } : r)))
      toast.error(errorMessage(err, 'Failed to update stock status.'))
    } finally {
      setBusyId(null)
    }
  }

  // Duplicate / Clone Item
  const handleDuplicate = async (item) => {
    setBusyId(item.id)
    try {
      const cloned = await itemApi.duplicate(item.id)
      setRows((curr) => [cloned, ...curr])
      toast.success(`Cloned "${item.name}" as "${cloned.name}"`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to clone dish.'))
    } finally {
      setBusyId(null)
    }
  }

  // Delete single item
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) return
    setBusyId(item.id)
    try {
      await itemApi.remove(item.id)
      setRows((curr) => curr.filter((r) => r.id !== item.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      toast.success(`Deleted "${item.name}"`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete dish.'))
    } finally {
      setBusyId(null)
    }
  }

  // Quick Inline Price Save
  const handleSaveInlinePrice = async (item, portion, value) => {
    const num = Number(value)
    if (value !== '' && (isNaN(num) || num < 0)) {
      toast.error('Please enter a valid price')
      return
    }

    const currentPrices = {}
    item.variants?.forEach((v) => {
      currentPrices[v.portion] = v.price
    })
    currentPrices[portion] = value === '' ? (portion === 'HALF' ? null : '0') : value

    try {
      const updated = await itemApi.quickUpdate(item.id, { prices: currentPrices })
      setRows((curr) => curr.map((r) => (r.id === item.id ? updated : r)))
      toast.success(`Updated ${portion.toLowerCase()} price for ${item.name}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update price.'))
    } finally {
      setInlinePriceEdit(null)
    }
  }

  // Multi-selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Bulk Actions
  const handleBulkSetStock = async (isAvailable) => {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await itemApi.bulkAction({
        action: 'set_stock',
        item_ids: Array.from(selectedIds),
        is_available: isAvailable,
      })
      setRows((curr) =>
        curr.map((r) =>
          selectedIds.has(r.id)
            ? {
                ...r,
                is_available: isAvailable,
                variants: r.variants?.map((v) => ({ ...v, is_available: isAvailable })),
              }
            : r
        )
      )
      toast.success(res.detail || 'Updated stock status for selected items.')
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(errorMessage(err, 'Bulk stock update failed.'))
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkMoveCategory = async (categoryId) => {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await itemApi.bulkAction({
        action: 'move_category',
        item_ids: Array.from(selectedIds),
        category_id: categoryId,
      })
      toast.success(res.detail || 'Moved selected items.')
      setSelectedIds(new Set())
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to move items.'))
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkAdjustPrice = async ({ mode, value }) => {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await itemApi.bulkAction({
        action: 'adjust_price',
        item_ids: Array.from(selectedIds),
        mode,
        value,
      })
      toast.success(res.detail || 'Prices updated.')
      setSelectedIds(new Set())
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to adjust prices.'))
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} selected dishes? This cannot be undone.`)) return
    setBulkBusy(true)
    try {
      const res = await itemApi.bulkAction({
        action: 'delete',
        item_ids: Array.from(selectedIds),
      })
      setRows((curr) => curr.filter((r) => !selectedIds.has(r.id)))
      toast.success(res.detail || 'Deleted selected dishes.')
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete selected dishes.'))
    } finally {
      setBulkBusy(false)
    }
  }

  const clearMenuCatalog = async () => {
    if (!window.confirm('⚠️ CRITICAL WARNING: All menu dishes and categories will be permanently erased! Proceed only if resetting your store catalog.')) return
    try {
      await itemApi.clearAll()
      setCats([])
      setRows([])
      setSelectedIds(new Set())
      toast.success('Menu catalog cleared successfully.')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to clear menu catalog.'))
    }
  }

  if (loading) return <PageLoader label="Loading Menu Catalog…" />

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id))

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-24">
      {/* ── 1. Top Header & Stats Hub ── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Stats */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🍽️</span> Menu Catalog
              </h1>
              <span className="rounded-full bg-slate-900 text-white px-3 py-0.5 text-xs font-black">
                {stats.totalItems} Dishes
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 text-xs font-black">
                {stats.vegCount} Veg
              </span>
              <span className="rounded-full bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-0.5 text-xs font-black">
                {stats.nonVegCount} Non-Veg
              </span>
              {stats.outOfStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
                  className="rounded-full bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-0.5 text-xs font-black hover:bg-amber-100 transition-colors animate-pulse"
                >
                  ⚠️ {stats.outOfStockCount} Out of Stock
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-400">
              {stats.activeCategories} Active Categories · Multi-Portion Variants · Instant 86-ing Stock Management
            </p>
          </div>

          {/* Action Toolbar */}
          {isOwner && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCategoryManager(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
              >
                🗂️ Categories
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
              >
                📤 Import CSV/Excel
              </button>

              <button
                type="button"
                onClick={() => itemApi.exportFile()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
              >
                📥 Export Menu
              </button>

              <button
                type="button"
                onClick={() => setEditingItem({})}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-all"
              >
                + New Dish
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Category Pill Slider / Strip ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Categories ({rows.length})
        </button>

        {cats.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id)
          const catItemCount = rows.filter((r) => String(r.category) === String(cat.id)).length
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? 'ALL' : String(cat.id))}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border ${
                isSelected
                  ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-xs font-black'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              } ${!cat.is_active ? 'opacity-60 border-dashed' : ''}`}
            >
              <span>{cat.name}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                isSelected ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {catItemCount}
              </span>
              {!cat.is_active && (
                <span className="size-1.5 rounded-full bg-amber-500" title="Disabled in POS" />
              )}
            </button>
          )
        })}

        {isOwner && (
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="px-3 py-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-slate-500 hover:border-slate-400 hover:text-slate-800 text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1"
          >
            <span>+</span> Manage Categories
          </button>
        )}
      </div>

      {/* ── 3. Filters, Sorting & View Switcher ── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes by name, category, or description... (Press / to search)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-6 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            ) : (
              <span className="hidden sm:block absolute right-3.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-black text-slate-400">
                /
              </span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Food Type Pill Toggle */}
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 shrink-0">
              {[
                { value: 'ALL', label: 'All' },
                { value: 'VEG', label: '🟢 Veg' },
                { value: 'NON_VEG', label: '🔴 Non-Veg' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFoodType(f.value)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                    foodType === f.value
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Stock Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shrink-0 cursor-pointer"
            >
              <option value="ALL">All Stock</option>
              <option value="IN_STOCK">✅ In Stock</option>
              <option value="OUT_OF_STOCK">⛔ Out of Stock (86'd)</option>
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shrink-0 cursor-pointer"
            >
              <option value="DEFAULT">Sort: Category Order</option>
              <option value="NAME_ASC">Name (A → Z)</option>
              <option value="NAME_DESC">Name (Z → A)</option>
              <option value="PRICE_ASC">Price (Low → High)</option>
              <option value="PRICE_DESC">Price (High → Low)</option>
            </select>

            {/* Layout View Mode Switcher */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View (Fast dense grid)"
                className={`p-1.5 rounded-xl transition-all ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Card View (Visual tiles)"
                className={`p-1.5 rounded-xl transition-all ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(search || selectedCategory !== 'ALL' || foodType !== 'ALL' || stockFilter !== 'ALL' || sortBy !== 'DEFAULT') && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold flex-wrap">
              <span>Found <strong className="text-slate-900 font-black">{filteredItems.length}</strong> matching dishes</span>
              {search && <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">Keyword: "{search}"</span>}
              {selectedCategory !== 'ALL' && (
                <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                  Category: {cats.find((c) => String(c.id) === String(selectedCategory))?.name}
                </span>
              )}
              {foodType !== 'ALL' && <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">{foodType}</span>}
              {stockFilter !== 'ALL' && <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">{stockFilter}</span>}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedCategory('ALL')
                setFoodType('ALL')
                setStockFilter('ALL')
                setSortBy('DEFAULT')
              }}
              className="text-rose-600 font-bold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Main Dishes List (Table or Grid View) ── */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No menu dishes found"
          hint={rows.length === 0 ? 'Your menu catalog is currently empty. Add your first dish or bulk import from CSV.' : 'No items match your active search and filter criteria.'}
          action={
            isOwner && rows.length === 0 ? (
              <button
                type="button"
                onClick={() => setEditingItem({})}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-rose-700 transition-all"
              >
                + Add First Dish
              </button>
            ) : null
          }
        />
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="space-y-6">
          {groupedItems.map(([catName, items]) => (
            <section key={catName} className="space-y-2.5">
              {/* Category Sub-Header */}
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {catName}
                </h2>
                <span className="rounded-full bg-slate-200/70 px-2 py-0.2 text-[10px] font-black text-slate-600">
                  {items.length}
                </span>
                <div className="flex-1 border-t border-slate-200/80" />
              </div>

              {/* Table Card */}
              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 font-black uppercase tracking-wider text-slate-400 text-[10px]">
                      {isOwner && (
                        <th className="w-12 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={items.every((it) => selectedIds.has(it.id))}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                items.forEach((it) => {
                                  if (checked) next.add(it.id)
                                  else next.delete(it.id)
                                })
                                return next
                              })
                            }}
                            className="size-4 accent-rose-600 rounded cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">Dish Details</th>
                      <th className="w-32 px-4 py-3 text-right">Half Price</th>
                      <th className="w-32 px-4 py-3 text-right">Full Price</th>
                      <th className="w-36 px-4 py-3 text-center">Stock Status</th>
                      {isOwner && <th className="w-28 px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.id)
                      const halfVariant = item.variants?.find((v) => v.portion === 'HALF')
                      const fullVariant = item.variants?.find((v) => v.portion === 'FULL')

                      return (
                        <tr
                          key={item.id}
                          className={`group transition-colors ${
                            isSelected
                              ? 'bg-rose-50/40'
                              : !item.is_available
                              ? 'bg-slate-50/60'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Checkbox */}
                          {isOwner && (
                            <td className="px-4 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(item.id)}
                                className="size-4 accent-rose-600 rounded cursor-pointer"
                              />
                            </td>
                          )}

                          {/* Name & Details */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <FoodTypeDot foodType={item.food_type} className="size-4 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-black text-sm text-slate-900 ${
                                      !item.is_available ? 'line-through text-slate-400' : ''
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                  {!item.is_available && (
                                    <span className="rounded bg-rose-100 text-rose-700 px-1.5 py-0.2 text-[9px] font-black">
                                      86'd
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Half Price (Inline Edit) */}
                          <td className="px-4 py-3.5 text-right font-bold text-slate-700">
                            {isOwner && inlinePriceEdit?.itemId === item.id && inlinePriceEdit?.portion === 'HALF' ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlinePriceEdit.value}
                                  onChange={(e) =>
                                    setInlinePriceEdit({ ...inlinePriceEdit, value: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlinePrice(item, 'HALF', inlinePriceEdit.value)
                                    if (e.key === 'Escape') setInlinePriceEdit(null)
                                  }}
                                  onBlur={() => handleSaveInlinePrice(item, 'HALF', inlinePriceEdit.value)}
                                  className="w-20 rounded-lg border border-rose-400 bg-white px-2 py-1 text-right text-xs font-bold text-slate-900 outline-none shadow-xs"
                                />
                              </div>
                            ) : (
                              <div
                                onClick={() =>
                                  isOwner &&
                                  setInlinePriceEdit({
                                    itemId: item.id,
                                    portion: 'HALF',
                                    value: halfVariant?.price ?? '',
                                  })
                                }
                                title={isOwner ? 'Click to edit price' : ''}
                                className={`inline-flex items-center gap-1.5 ${
                                  isOwner ? 'cursor-pointer hover:text-rose-600 group-hover:underline' : ''
                                }`}
                              >
                                {halfVariant ? (
                                  <span>{priceShort(halfVariant.price)}</span>
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                                {isOwner && halfVariant && (
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400">
                                    ✎
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Full Price (Inline Edit) */}
                          <td className="px-4 py-3.5 text-right font-black text-slate-900 text-sm">
                            {isOwner && inlinePriceEdit?.itemId === item.id && inlinePriceEdit?.portion === 'FULL' ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlinePriceEdit.value}
                                  onChange={(e) =>
                                    setInlinePriceEdit({ ...inlinePriceEdit, value: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlinePrice(item, 'FULL', inlinePriceEdit.value)
                                    if (e.key === 'Escape') setInlinePriceEdit(null)
                                  }}
                                  onBlur={() => handleSaveInlinePrice(item, 'FULL', inlinePriceEdit.value)}
                                  className="w-20 rounded-lg border border-rose-400 bg-white px-2 py-1 text-right text-xs font-black text-slate-900 outline-none shadow-xs"
                                />
                              </div>
                            ) : (
                              <div
                                onClick={() =>
                                  isOwner &&
                                  setInlinePriceEdit({
                                    itemId: item.id,
                                    portion: 'FULL',
                                    value: fullVariant?.price ?? '',
                                  })
                                }
                                title={isOwner ? 'Click to edit price' : ''}
                                className={`inline-flex items-center gap-1.5 ${
                                  isOwner ? 'cursor-pointer hover:text-rose-600 group-hover:underline' : ''
                                }`}
                              >
                                {fullVariant ? (
                                  <span>{priceShort(fullVariant.price)}</span>
                                ) : (
                                  <span className="text-slate-300 font-normal">₹0</span>
                                )}
                                {isOwner && (
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400">
                                    ✎
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Stock Toggle */}
                          <td className="px-4 py-3.5 text-center">
                            {isOwner ? (
                              <div className="flex justify-center">
                                <Toggle
                                  checked={item.is_available}
                                  disabled={busyId === item.id}
                                  onChange={() => handleToggleStock(item)}
                                  label={item.name}
                                />
                              </div>
                            ) : (
                              <Badge tone={item.is_available ? 'green' : 'red'}>
                                {item.is_available ? 'In Stock' : 'Out of Stock'}
                              </Badge>
                            )}
                          </td>

                          {/* Actions */}
                          {isOwner && (
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(item)}
                                  disabled={busyId === item.id}
                                  title="Duplicate / Clone Dish"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  📋
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(item)}
                                  title="Edit Dish Details"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  disabled={busyId === item.id}
                                  title="Delete Dish"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
      ) : (
        /* ── GRID CARD VIEW ── */
        <div className="space-y-6">
          {groupedItems.map(([catName, items]) => (
            <section key={catName} className="space-y-3">
              {/* Category Sub-Header */}
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {catName}
                </h2>
                <span className="rounded-full bg-slate-200/70 px-2 py-0.2 text-[10px] font-black text-slate-600">
                  {items.length}
                </span>
                <div className="flex-1 border-t border-slate-200/80" />
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  const halfVariant = item.variants?.find((v) => v.portion === 'HALF')
                  const fullVariant = item.variants?.find((v) => v.portion === 'FULL')

                  return (
                    <div
                      key={item.id}
                      className={`relative flex flex-col justify-between rounded-3xl border p-4 transition-all ${
                        isSelected
                          ? 'border-rose-400 bg-rose-50/50 shadow-md ring-2 ring-rose-200'
                          : !item.is_available
                          ? 'border-slate-200 bg-slate-50/70 opacity-80'
                          : 'border-slate-200/90 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Top bar: Checkbox, FoodType & Menu Actions */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {isOwner && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="size-4 accent-rose-600 rounded cursor-pointer mt-0.5"
                            />
                          )}
                          <FoodTypeDot foodType={item.food_type} className="size-4 shrink-0" />
                        </div>

                        {/* Quick Action Pills */}
                        {isOwner && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(item)}
                              title="Duplicate Dish"
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                              📋
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              title="Edit Dish"
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              title="Delete Dish"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3 className={`font-black text-sm text-slate-900 ${!item.is_available ? 'line-through text-slate-400' : ''}`}>
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom Pricing & Stock Switch */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {halfVariant && (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                              H: {priceShort(halfVariant.price)}
                            </span>
                          )}
                          <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                            F: {fullVariant ? priceShort(fullVariant.price) : '₹0'}
                          </span>
                        </div>

                        {isOwner ? (
                          <Toggle
                            checked={item.is_available}
                            disabled={busyId === item.id}
                            onChange={() => handleToggleStock(item)}
                            label={item.name}
                          />
                        ) : (
                          <Badge tone={item.is_available ? 'green' : 'red'}>
                            {item.is_available ? 'In' : 'Out'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── 5. Floating Bulk Actions Toolbar (When >= 1 Item Selected) ── */}
      {selectedIds.size > 0 && isOwner && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/95 px-5 py-3 shadow-2xl backdrop-blur-md text-white">
            <span className="text-xs font-black bg-rose-600 text-white rounded-full px-2.5 py-1">
              {selectedIds.size} Selected
            </span>

            <div className="h-4 w-px bg-slate-700" />

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleBulkSetStock(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors"
              >
                ✅ In Stock
              </button>

              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleBulkSetStock(false)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white transition-colors"
              >
                ⛔ 86 (Out of Stock)
              </button>

              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkPriceModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors"
              >
                💰 Adjust Prices
              </button>

              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkCategoryModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors"
              >
                📁 Move Category
              </button>

              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-xs font-bold text-white transition-colors"
              >
                🗑️ Delete
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700" />

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1 rounded-lg text-slate-400 hover:text-white text-xs font-bold"
              title="Deselect All"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 6. Modals ── */}
      {editingItem && (
        <ItemFormModal
          item={editingItem.id ? editingItem : null}
          categories={cats}
          onClose={() => setEditingItem(null)}
          onCategoryCreated={(newCat) => {
            setCats((c) => [...c, newCat])
          }}
          onSaved={(saved, wasNew) => {
            setRows((c) => (wasNew ? [saved, ...c] : c.map((r) => (r.id === saved.id ? saved : r))))
            setEditingItem(null)
            toast.success(`${saved.name} ${wasNew ? 'added' : 'updated'}.`)
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal
          categories={cats}
          onClose={() => setShowCategoryManager(false)}
          onRefresh={load}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(summary) => {
            load()
            toast.success(`Import complete: ${summary.created} added, ${summary.updated} updated`)
          }}
        />
      )}

      {showBulkPriceModal && (
        <BulkPriceModal
          selectedCount={selectedIds.size}
          onClose={() => setShowBulkPriceModal(false)}
          onApply={handleBulkAdjustPrice}
        />
      )}

      {showBulkCategoryModal && (
        <BulkCategoryModal
          selectedCount={selectedIds.size}
          categories={cats}
          onClose={() => setShowBulkCategoryModal(false)}
          onApply={handleBulkMoveCategory}
        />
      )}
    </div>
  )
}
