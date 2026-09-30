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
  const catSliderRef = useRef(null)
  const stockMenuRef = useRef(null)
  const sortMenuRef = useRef(null)

  const [stockMenuOpen, setStockMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    const el = catSliderRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }, [])

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

  // Check category slider scrollability
  useEffect(() => {
    const el = catSliderRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll, cats.length])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (stockMenuRef.current && !stockMenuRef.current.contains(e.target)) {
        setStockMenuOpen(false)
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setSortMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const scrollSlider = (direction) => {
    if (!catSliderRef.current) return
    const offset = direction === 'left' ? -280 : 280
    catSliderRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

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
    <div className="w-full space-y-4 pb-20">
      {/* ── 1. Top Compact Header & Action Strip ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-5 py-3.5 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Warning Stats */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-xl">🍽️</span> Menu Catalog
            </h1>
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

          {/* Action Toolbar with Sleek Modern UI */}
          {isOwner && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Refined Segmented Action Bar */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/90 shadow-2xs">
                {/* 1. Categories Button */}
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <svg className="size-3.5 text-slate-500 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                  <span>Categories</span>
                </button>

                {/* Vertical subtle divider */}
                <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

                {/* 2. Import Button */}
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <svg className="size-3.5 text-slate-500 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span>Import</span>
                </button>

                {/* Vertical subtle divider */}
                <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

                {/* 3. Export Button */}
                <button
                  type="button"
                  onClick={() => itemApi.exportFile()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <svg className="size-3.5 text-slate-500 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span>Export</span>
                </button>
              </div>

              {/* Primary + New Dish Button */}
              <button
                type="button"
                onClick={() => setEditingItem({})}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-rose-500 hover:to-rose-600 hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <svg className="size-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>New Dish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Category Pill Slider / Strip with Crimson Red Theme & Smooth Controls ── */}
      <div className="relative group w-full flex items-center py-1">
        {/* Left Scroll Navigation Arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollSlider('left')}
            className="absolute left-0 z-20 flex size-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md border border-slate-200/90 hover:bg-rose-50 hover:text-rose-600 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs -translate-x-1"
            aria-label="Scroll categories left"
          >
            <svg className="size-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Category Scroll Container */}
        <div
          ref={catSliderRef}
          className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth no-scrollbar w-full px-1"
        >
          {/* All Categories Pill */}
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-2xl text-xs whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer select-none ${
              selectedCategory === 'ALL'
                ? 'bg-gradient-to-r from-[#FF453A] via-[#E11D48] to-[#C81E46] text-white shadow-md shadow-rose-500/30 font-black ring-2 ring-rose-400/50 scale-[1.02]'
                : 'bg-white/95 border border-slate-200/90 text-slate-700 hover:text-slate-950 hover:border-rose-300 hover:shadow-xs font-bold active:scale-95'
            }`}
          >
            <span>All Categories</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-white/25 text-white ring-1 ring-white/30'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-rose-50 group-hover:text-rose-700'
              }`}
            >
              {rows.length}
            </span>
          </button>

          {/* Individual Category Pills */}
          {cats.map((cat) => {
            const isSelected = String(selectedCategory) === String(cat.id)
            const catItemCount = rows.filter((r) => String(r.category) === String(cat.id)).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : String(cat.id))}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-2xl text-xs whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#FF453A] via-[#E11D48] to-[#C81E46] text-white shadow-md shadow-rose-500/30 font-black ring-2 ring-rose-400/50 scale-[1.02]'
                    : 'bg-white/95 border border-slate-200/90 text-slate-700 hover:text-slate-950 hover:border-rose-300 hover:shadow-xs font-bold active:scale-95'
                } ${!cat.is_active ? 'opacity-60 border-dashed' : ''}`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono transition-colors ${
                    isSelected
                      ? 'bg-white/25 text-white ring-1 ring-white/30'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-rose-50 group-hover:text-rose-700'
                  }`}
                >
                  {catItemCount}
                </span>
                {!cat.is_active && (
                  <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" title="Disabled in POS" />
                )}
              </button>
            )
          })}

          {/* Manage Categories Action */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowCategoryManager(true)}
              className="px-3.5 py-2 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 text-slate-600 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50/40 text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="text-sm font-bold text-rose-500">+</span> Manage Categories
            </button>
          )}
        </div>

        {/* Right Scroll Navigation Arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollSlider('right')}
            className="absolute right-0 z-20 flex size-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md border border-slate-200/90 hover:bg-rose-50 hover:text-rose-600 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs translate-x-1"
            aria-label="Scroll categories right"
          >
            <svg className="size-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* ── 3. Filters, Sorting & View Switcher (Clean Modern Toolbar) ── */}
      <div className="relative z-30 rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
              placeholder="Search dishes by name, category, or ingredients... (Press / to focus)"
              className="w-full rounded-xl border border-slate-200/90 bg-slate-50/80 py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-5 flex items-center justify-center text-xs font-bold rounded hover:bg-slate-200/60 cursor-pointer"
              >
                ✕
              </button>
            ) : (
              <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.2 rounded border border-slate-200 bg-white text-[10px] font-mono font-bold text-slate-400">
                /
              </span>
            )}
          </div>

          {/* Filter Controls Strip */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Food Type Segmented Slider with Pixel-Perfect Glider */}
            <div className="relative grid grid-cols-3 w-64 bg-slate-100 p-1 rounded-xl border border-slate-200/90 shadow-inner select-none">
              {/* Red Sliding Background Glider */}
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-r from-[#FF453A] via-[#E11D48] to-[#C81E46] shadow-md shadow-rose-500/30 transition-transform duration-300 ease-[cubic-bezier(0.2,0.85,0.32,1.2)] pointer-events-none"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  left: '4px',
                  transform: `translateX(${foodType === 'ALL' ? '0%' : foodType === 'VEG' ? '100%' : '200%'})`,
                }}
              />

              {[
                { value: 'ALL', label: 'All' },
                { value: 'VEG', label: 'Veg', dot: 'bg-emerald-500 ring-emerald-200' },
                { value: 'NON_VEG', label: 'Non-Veg', dot: 'bg-rose-500 ring-rose-200' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFoodType(f.value)}
                  className={`relative z-10 py-1.5 px-2 text-xs transition-colors duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5 select-none ${
                    foodType === f.value
                      ? 'text-white font-black'
                      : 'text-slate-600 hover:text-slate-900 font-bold'
                  }`}
                >
                  {f.dot && (
                    <span
                      className={`size-2 rounded-full ring-2 transition-all ${
                        foodType === f.value ? 'bg-white ring-white/50 shadow-xs' : f.dot
                      }`}
                    />
                  )}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Custom Modern Stock Filter Dropdown */}
            <div ref={stockMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setStockMenuOpen((prev) => !prev)
                  setSortMenuOpen(false)
                }}
                className={`group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                  stockMenuOpen
                    ? 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200/80 shadow-sm font-black'
                    : stockFilter !== 'ALL'
                    ? stockFilter === 'IN_STOCK'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                      : 'border-rose-300 bg-rose-50 text-rose-950 font-black shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {/* Status dot indicator */}
                {stockFilter === 'ALL' ? (
                  <span className="size-2 rounded-full bg-slate-400" />
                ) : stockFilter === 'IN_STOCK' ? (
                  <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                ) : (
                  <span className="size-2 rounded-full bg-rose-500 ring-2 ring-rose-200 animate-pulse" />
                )}

                <span className="font-extrabold">
                  {stockFilter === 'ALL'
                    ? 'All Stock'
                    : stockFilter === 'IN_STOCK'
                    ? 'In Stock'
                    : "86'd Dishes"}
                </span>

                {/* Count Badge on button if filtered */}
                {stockFilter === 'IN_STOCK' && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/70 text-emerald-900 text-[10px] font-black">
                    {stats.inStockCount}
                  </span>
                )}
                {stockFilter === 'OUT_OF_STOCK' && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-200/80 text-rose-900 text-[10px] font-black">
                    {stats.outOfStockCount}
                  </span>
                )}

                <svg
                  className={`size-3.5 text-slate-400 transition-all duration-200 group-hover:text-slate-700 ${
                    stockMenuOpen ? 'rotate-180 text-rose-600' : 'group-hover:translate-y-0.5'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Smooth Animated Stock Dropdown Menu */}
              {stockMenuOpen && (
                <div
                  style={{ backgroundColor: '#ffffff' }}
                  className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/20 p-2 z-[999] animate-fade-in"
                >
                  {/* Header with quick reset */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <span>📦</span> Stock Availability
                    </span>
                    {stockFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStockFilter('ALL')
                          setStockMenuOpen(false)
                        }}
                        className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="space-y-1.5 pt-2">
                    {[
                      {
                        value: 'ALL',
                        title: 'All Dishes',
                        desc: 'Show complete menu catalog',
                        count: rows.length,
                        icon: '📦',
                        iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
                        badgeBg: 'bg-slate-100 text-slate-600',
                      },
                      {
                        value: 'IN_STOCK',
                        title: 'In Stock Only',
                        desc: 'Available for order & billing',
                        count: stats.inStockCount,
                        icon: '✅',
                        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                      },
                      {
                        value: 'OUT_OF_STOCK',
                        title: "Out of Stock (86'd)",
                        desc: 'Temporarily unavailable dishes',
                        count: stats.outOfStockCount,
                        icon: '⛔',
                        iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
                        badgeBg: 'bg-rose-50 text-rose-700 border border-rose-200',
                      },
                    ].map((opt) => {
                      const isSelected = stockFilter === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setStockFilter(opt.value)
                            setStockMenuOpen(false)
                          }}
                          className={`group flex items-center justify-between w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 select-none active:scale-[0.99] ${
                            isSelected
                              ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
                              : 'bg-white border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`size-8.5 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 ${opt.iconBg}`}>
                              {opt.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs ${isSelected ? 'font-black text-rose-950' : 'font-bold text-slate-900'}`}>
                                  {opt.title}
                                </span>
                              </div>
                              <span className="block text-[10px] font-medium text-slate-400 leading-tight">
                                {opt.desc}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${opt.badgeBg}`}>
                              {opt.count}
                            </span>
                            {isSelected ? (
                              <svg className="size-4 text-rose-600 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <div className="size-4 rounded-full border border-slate-200 group-hover:border-slate-300" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Custom Smooth Animated Sort Dropdown */}
            <div ref={sortMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSortMenuOpen((prev) => !prev)
                  setStockMenuOpen(false)
                }}
                className={`group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                  sortMenuOpen
                    ? 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200/80 shadow-sm font-black'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400 hover:bg-rose-50/40 hover:text-rose-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                }`}
              >
                <span className="font-extrabold">
                  {sortBy === 'DEFAULT'
                    ? 'Sort: Category'
                    : sortBy === 'NAME_ASC'
                    ? 'Name (A → Z)'
                    : sortBy === 'NAME_DESC'
                    ? 'Name (Z → A)'
                    : sortBy === 'PRICE_ASC'
                    ? 'Price (Low → High)'
                    : 'Price (High → Low)'}
                </span>
                <svg
                  className={`size-3.5 text-slate-400 transition-all duration-200 group-hover:text-rose-500 ${
                    sortMenuOpen ? 'rotate-180 text-rose-600' : 'group-hover:translate-y-0.5'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Smooth Animated Sort Dropdown Menu */}
              {sortMenuOpen && (
                <div
                  style={{ backgroundColor: '#ffffff' }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/20 p-2 z-[999] animate-fade-in divide-y divide-slate-100"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Sort Dishes By
                  </div>
                  <div className="space-y-1 pt-1.5">
                    {[
                      { value: 'DEFAULT', label: 'Category Order', sub: 'Default menu layout', icon: '🗂️' },
                      { value: 'NAME_ASC', label: 'Name (A → Z)', sub: 'Alphabetical order', icon: '🔤' },
                      { value: 'NAME_DESC', label: 'Name (Z → A)', sub: 'Reverse alphabetical', icon: '🔤' },
                      { value: 'PRICE_ASC', label: 'Price (Low → High)', sub: 'Budget friendly first', icon: '💵' },
                      { value: 'PRICE_DESC', label: 'Price (High → Low)', sub: 'Premium dishes first', icon: '💵' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value)
                          setSortMenuOpen(false)
                        }}
                        className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 text-left cursor-pointer select-none active:scale-[0.98] ${
                          sortBy === opt.value
                            ? 'bg-rose-50 text-rose-900 font-black border border-rose-200/80'
                            : 'text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="text-base transition-transform duration-200 group-hover:scale-125 inline-block">
                            {opt.icon}
                          </span>
                          <span>
                            <span className="block leading-tight">{opt.label}</span>
                            <span className="block text-[10px] font-medium text-slate-400 leading-tight">{opt.sub}</span>
                          </span>
                        </span>
                        {sortBy === opt.value ? (
                          <svg className="size-4 text-rose-600 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <span className="size-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Layout View Mode Switcher */}
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View (List)"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="size-4 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid View (Cards)"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="size-4 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
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
