import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { priceShort } from '@/utils/format'

export default function MenuGrid({ items, categories, busyVariant, onAdd, disabled }) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [foodType, setFoodType] = useState('all')
  const searchRef = useRef(null)
  const categoryContainerRef = useRef(null)

  // Sliding pill glider state for food type filter (All / Veg / Non-Veg)
  const foodTypeContainerRef = useRef(null)
  const foodTypeButtonsRef = useRef({})
  const [foodTypeGliderStyle, setFoodTypeGliderStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updateFoodTypeGlider = () => {
    const activeBtn = foodTypeButtonsRef.current[foodType]
    const container = foodTypeContainerRef.current
    if (activeBtn && container) {
      const containerRect = container.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      if (btnRect.width > 0) {
        setFoodTypeGliderStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
          opacity: 1,
        })
      }
    }
  }

  useLayoutEffect(() => {
    updateFoodTypeGlider()
  }, [foodType])

  useEffect(() => {
    const frame = requestAnimationFrame(updateFoodTypeGlider)
    window.addEventListener('resize', updateFoodTypeGlider)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateFoodTypeGlider)
    }
  }, [foodType])

  // Keyboard shortcut '/' focus search
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

  // Horizontal scroll drag support for categories
  useEffect(() => {
    const el = categoryContainerRef.current
    if (!el) return
    let isDown = false
    let startX = 0
    let scrollLeft = 0

    const onMouseDown = (e) => {
      isDown = true
      startX = e.pageX - el.offsetLeft
      scrollLeft = el.scrollLeft
    }
    const onMouseLeave = () => { isDown = false }
    const onMouseUp = () => { isDown = false }
    const onMouseMove = (e) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - startX) * 1.5
      el.scrollLeft = scrollLeft - walk
    }

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * 0.9
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseleave', onMouseLeave)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const activeCategories = useMemo(() => {
    const categoryIdsWithItems = new Set(
      items.filter((i) => i.is_available).map((i) => String(i.category))
    )
    return categories.filter((c) => categoryIdsWithItems.has(String(c.id)))
  }, [items, categories])

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: ['name', 'short_code', 'category_name'],
      threshold: 0.4,
      ignoreLocation: true,
    })
  }, [items])

  const visible = useMemo(() => {
    const needle = search.trim()
    let searchResults = items
    if (needle) {
      searchResults = fuse.search(needle).map((result) => result.item)
    }

    return searchResults.filter(
      (item) =>
        item.is_available &&
        (categoryId === 'all' || String(item.category) === categoryId) &&
        (foodType === 'all' || item.food_type === foodType)
    )
  }, [items, fuse, search, categoryId, foodType])

  const resetFilters = () => {
    setSearch('')
    setCategoryId('all')
    setFoodType('all')
    searchRef.current?.focus()
  }

  // Flying particle animation
  const triggerFlyToCart = (event, price) => {
    try {
      const clickBtn = event?.currentTarget || event?.target
      const badgeTarget = document.getElementById('cartItemsBadge')
      if (!clickBtn || !badgeTarget) return

      const btnRect = clickBtn.getBoundingClientRect()
      const targetRect = badgeTarget.getBoundingClientRect()

      const flyingEl = document.createElement('div')
      flyingEl.className =
        'flying-cart-badge flex items-center gap-1.5 bg-[#E11D48] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-rose-500/40 pointer-events-none'
      flyingEl.style.left = `${btnRect.left + btnRect.width / 2}px`
      flyingEl.style.top = `${btnRect.top + btnRect.height / 2}px`
      flyingEl.style.transform = 'translate(-50%, -50%) scale(0.7)'
      flyingEl.style.opacity = '0.9'
      flyingEl.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i> <span>₹${price}</span>`
      document.body.appendChild(flyingEl)

      flyingEl.getBoundingClientRect()

      const targetX = targetRect.left + targetRect.width / 2
      const targetY = targetRect.top + targetRect.height / 2

      requestAnimationFrame(() => {
        flyingEl.style.left = `${targetX}px`
        flyingEl.style.top = `${targetY}px`
        flyingEl.style.transform = 'translate(-50%, -50%) scale(1.15)'
        flyingEl.style.opacity = '1'
      })

      setTimeout(() => {
        flyingEl.style.opacity = '0'
        flyingEl.style.transform = 'translate(-50%, -50%) scale(0.4)'
        setTimeout(() => flyingEl.remove(), 120)

        badgeTarget.classList.remove('badge-pop')
        void badgeTarget.offsetWidth
        badgeTarget.classList.add('badge-pop')

        const cartList = document.getElementById('cartItemsList')
        if (cartList) {
          cartList.classList.add('cart-flash')
          setTimeout(() => cartList.classList.remove('cart-flash'), 400)
        }
      }, 320)
    } catch {
      // Ignore animation errors
    }
  }

  const handleAddVariant = (variant, e) => {
    triggerFlyToCart(e, variant.price)
    onAdd(variant)
  }

  const scrollCategories = (direction) => {
    if (categoryContainerRef.current) {
      const offset = direction === 'left' ? -220 : 220
      categoryContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-purpose="menu-catalog">
      {/* Search and Segmented Filters */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1 w-full">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes... (press '/' to focus)"
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-14 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm transition"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                title="Clear search"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
            <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 select-none">
              /
            </span>
          </div>
        </div>

        {/* Type Filter Segmented Control with Smooth Sliding Glider */}
        <div
          ref={foodTypeContainerRef}
          className="relative flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] text-xs select-none shrink-0 gap-1 w-full sm:w-auto justify-center sm:justify-start"
          data-purpose="segmented-food-type-filter"
        >
          {/* Sliding Black Background Glider */}
          <div
            aria-hidden="true"
            style={{
              transform: `translateX(${foodTypeGliderStyle.left}px)`,
              width: `${foodTypeGliderStyle.width}px`,
              opacity: foodTypeGliderStyle.opacity,
            }}
            className="pill-glider absolute left-0 top-1 bottom-1 bg-slate-900 rounded-full shadow-[0_4px_12px_-2px_rgba(15,23,42,0.35)] pointer-events-none"
          />

          {[
            { id: 'all', label: 'All Items' },
            { id: 'VEG', label: 'Veg', isVeg: true },
            { id: 'NON_VEG', label: 'Non-Veg', isNonVeg: true },
          ].map((pill) => {
            const isActive = foodType === pill.id
            return (
              <button
                key={pill.id}
                ref={(el) => (foodTypeButtonsRef.current[pill.id] = el)}
                type="button"
                onClick={() => setFoodType(pill.id)}
                className={`relative z-10 px-3.5 sm:px-4 py-1.5 rounded-full font-semibold flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 select-none cursor-pointer active:scale-95 ${
                  isActive
                    ? 'text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {pill.isVeg && (
                  <span
                    className={`w-3 h-3 border-2 rounded flex items-center justify-center p-[1px] shrink-0 transition-colors ${
                      isActive ? 'border-white bg-transparent' : 'border-emerald-600 bg-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block transition-colors ${
                        isActive ? 'bg-white' : 'bg-emerald-600'
                      }`}
                    ></span>
                  </span>
                )}
                {pill.isNonVeg && (
                  <span
                    className={`w-3 h-3 border-2 rounded flex items-center justify-center p-[1px] shrink-0 transition-colors ${
                      isActive ? 'border-white bg-transparent' : 'border-rose-600 bg-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block transition-colors ${
                        isActive ? 'bg-white' : 'bg-rose-600'
                      }`}
                    ></span>
                  </span>
                )}
                <span>{pill.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category Horizontal Pills with Visible Scrollbar & Smooth Nav Chevrons */}
      <div className="shrink-0 flex items-center gap-1.5 w-full">
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="shrink-0 w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-xs transition active:scale-95 shadow-xs cursor-pointer"
          title="Scroll Left"
        >
          <i className="fa-solid fa-chevron-left text-[11px]"></i>
        </button>

        <div
          ref={categoryContainerRef}
          className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scroll-thin pb-2 pt-0.5 text-xs font-semibold scroll-smooth cursor-grab active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => setCategoryId('all')}
            className={`category-pill whitespace-nowrap px-4 py-2 rounded-full transition-all duration-200 active:scale-95 cursor-pointer shrink-0 ${
              categoryId === 'all'
                ? 'bg-brand text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            All Dishes ({items.filter((i) => i.is_available).length})
          </button>

          {activeCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(String(c.id))}
              className={`category-pill whitespace-nowrap px-4 py-2 rounded-full transition-all duration-200 active:scale-95 cursor-pointer shrink-0 ${
                categoryId === String(c.id)
                  ? 'bg-brand text-white shadow-sm font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="shrink-0 w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-xs transition active:scale-95 shadow-xs cursor-pointer"
          title="Scroll Right"
        >
          <i className="fa-solid fa-chevron-right text-[11px]"></i>
        </button>
      </div>

      {/* Menu Cards Grid (3 Columns) with Compact Layout and Independent Smooth Scroll */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6 scroll-thin">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-brand text-lg mb-3">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No dishes found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Try searching with a different term or switch the category filter.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 relative menu-transition-slide-in">
            {visible.map((item, index) => {
              const variants = item.variants || []
              const half = variants.find((v) => v.portion === 'HALF')
              const full = variants.find((v) => v.portion === 'FULL')
              const single = variants.length === 1 ? variants[0] : null
              const startingPrice = variants[0]?.price ? priceShort(variants[0].price) : ''

              const isVeg = item.food_type === 'VEG'

              return (
                <div
                  key={item.id}
                  className="menu-card menu-card-wrapper group card-animate relative"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <div
                    onClick={(e) => {
                      if (e.target.closest('button')) return
                      if (single) handleAddVariant(single, e)
                      else if (full) handleAddVariant(full, e)
                      else if (variants[0]) handleAddVariant(variants[0], e)
                    }}
                    className="menu-card-inner absolute inset-x-0 top-0 bg-white rounded-2xl p-3 border border-slate-100 flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    {/* Compact Header: Veg indicator, Category, Badge, Default Starting Price */}
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-3 h-3 border-2 ${
                              isVeg ? 'border-emerald-600' : 'border-rose-600'
                            } rounded flex items-center justify-center p-[1px] bg-white shrink-0`}
                          >
                            <span
                              className={`w-1 h-1 ${
                                isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                              } rounded-full inline-block`}
                            ></span>
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase truncate">
                            {item.category_name || 'Dish'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.is_popular && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <i className="fa-solid fa-fire-flame-curved text-[8px] text-amber-500"></i> Popular
                            </span>
                          )}
                          <span className="text-xs font-black text-slate-800 group-hover:opacity-40 transition-opacity tabular">
                            ₹{startingPrice}
                          </span>
                        </div>
                      </div>
                      <h2
                        className="font-bold text-slate-800 text-xs mt-1.5 leading-snug card-title truncate"
                        title={item.name}
                      >
                        {item.name}
                      </h2>
                    </div>

                    {/* Hover Revealed Portion Buttons */}
                    <div className="menu-card-buttons">
                      {half && full ? (
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={disabled || busyVariant === half.id}
                            onClick={(e) => handleAddVariant(half, e)}
                            className="py-1.5 px-2 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-600 flex items-center justify-between text-xs font-bold hover:bg-rose-100 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50"
                          >
                            <span className="text-[10px] font-bold text-slate-600">HALF</span>
                            <span className="tabular">₹{priceShort(half.price)}</span>
                          </button>
                          <button
                            type="button"
                            disabled={disabled || busyVariant === full.id}
                            onClick={(e) => handleAddVariant(full, e)}
                            className="py-1.5 px-2 rounded-xl bg-brand text-white flex items-center justify-between text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <span className="text-[10px] font-bold text-white/90">FULL</span>
                            <span className="tabular">₹{priceShort(full.price)}</span>
                          </button>
                        </div>
                      ) : single ? (
                        <button
                          type="button"
                          disabled={disabled || busyVariant === single.id}
                          onClick={(e) => handleAddVariant(single, e)}
                          className="w-full py-1.5 px-3 rounded-xl bg-brand text-white flex items-center justify-between text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <i className="fa-regular fa-plus font-bold"></i> Add Portion
                          </span>
                          <span className="tabular">₹{priceShort(single.price)}</span>
                        </button>
                      ) : (
                        <div className="flex gap-1 pt-0.5">
                          {variants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              disabled={disabled || busyVariant === v.id}
                              onClick={(e) => handleAddVariant(v, e)}
                              className="flex-1 py-1.5 px-2 rounded-xl bg-brand text-white flex items-center justify-between text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <span className="text-[10px] font-bold uppercase truncate">{v.portion}</span>
                              <span className="tabular">₹{priceShort(v.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
