import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { tables as tableApi, TABLE_STATUS } from '@/services/tables'
import { orders as orderApi } from '@/services/billing'
import Button from '@/components/ui/Button'
import { FormRow, Input, Select } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import TransferModal from '@/components/tables/TransferModal'

const CELL_SIZE = 110
const GRID_COLS = 8
const GRID_ROWS = 6

export default function TableManagement() {
  const { isOwner } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tablesList, setTablesList] = useState([])
  const [sectionsList, setSectionsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'designer'
  
  // Filters & Search
  const [search, setSearch] = useState('')
  const [selectedSection, setSelectedSection] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [includeInactive, setIncludeInactive] = useState(true)

  // Layout Designer State
  const [dirtyLayout, setDirtyLayout] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [autoArranging, setAutoArranging] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const gridContainerRef = useRef(null)

  // Modals
  const [editModalTable, setEditModalTable] = useState(null) // null = closed, {} = add, table = edit
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [qrModalTable, setQrModalTable] = useState(null)
  const [transferTable, setTransferTable] = useState(null)
  const [deleteConfirmTable, setDeleteConfirmTable] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Load tables & sections
  const loadData = useCallback(async () => {
    try {
      const [allTables, secData] = await Promise.all([
        tableApi.list({ all: true }).catch(() => []),
        tableApi.sections().catch(() => []),
      ])
      setTablesList(allTables || [])
      setSectionsList(secData || [])
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load table management data.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Summary Metrics
  const summary = useMemo(() => {
    const s = {
      total: tablesList.length,
      available: 0,
      occupied: 0,
      billed: 0,
      inactive: 0,
      totalSeats: 0,
    }
    for (const t of tablesList) {
      if (!t.is_active) {
        s.inactive += 1
      } else {
        if (t.status === 'AVAILABLE') s.available += 1
        else if (t.status === 'OCCUPIED') s.occupied += 1
        else if (t.status === 'BILLED') s.billed += 1
      }
      s.totalSeats += Number(t.seats || 0)
    }
    return s
  }, [tablesList])

  // Unique sections array
  const allSections = useMemo(() => {
    const set = new Set()
    for (const t of tablesList) {
      if (t.label && t.label.trim()) set.add(t.label.trim())
    }
    return Array.from(set).sort()
  }, [tablesList])

  // Filtered tables for Card view
  const filteredTables = useMemo(() => {
    return tablesList.filter((t) => {
      if (!includeInactive && !t.is_active) return false
      if (selectedSection !== 'ALL') {
        const sec = t.label?.trim() || 'General'
        if (sec !== selectedSection) return false
      }
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'INACTIVE') {
          if (t.is_active) return false
        } else if (t.status !== selectedStatus) {
          return false
        }
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const numMatch = String(t.number).toLowerCase().includes(q)
        const labelMatch = (t.label || '').toLowerCase().includes(q)
        if (!numMatch && !labelMatch) return false
      }
      return true
    })
  }, [tablesList, includeInactive, selectedSection, selectedStatus, search])

  // Drag and drop for Floor Designer
  const handleDragStart = (e, table) => {
    e.stopPropagation()
    setDraggingId(table.id)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (!draggingId || !gridContainerRef.current) return
    const containerRect = gridContainerRef.current.getBoundingClientRect()
    const clientX = e.clientX - containerRect.left
    const clientY = e.clientY - containerRect.top

    let cellX = Math.round((clientX - dragOffset.x) / CELL_SIZE)
    let cellY = Math.round((clientY - dragOffset.y) / CELL_SIZE)

    cellX = Math.max(0, Math.min(GRID_COLS - 1, cellX))
    cellY = Math.max(0, Math.min(GRID_ROWS - 1, cellY))

    setTablesList((prev) =>
      prev.map((t) => (t.id === draggingId ? { ...t, pos_x: cellX, pos_y: cellY } : t))
    )
    setDirtyLayout(true)
    setDraggingId(null)
  }

  const handleSaveLayout = async () => {
    setSavingLayout(true)
    try {
      const positions = tablesList.map((t) => ({
        id: t.id,
        pos_x: t.pos_x ?? 0,
        pos_y: t.pos_y ?? 0,
      }))
      await tableApi.saveLayout(positions)
      setDirtyLayout(false)
      toast.success('Floor layout positions saved successfully!')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save floor layout.'))
    } finally {
      setSavingLayout(false)
    }
  }

  const handleAutoArrange = async () => {
    if (!window.confirm('Auto-arrange will neatly align all tables in a clean grid. Proceed?')) return
    setAutoArranging(true)
    try {
      await tableApi.autoArrange(GRID_COLS)
      toast.success('Grid auto-arranged neatly!')
      await loadData()
      setDirtyLayout(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Auto-arrange failed.'))
    } finally {
      setAutoArranging(false)
    }
  }

  // Toggle table active/inactive
  const handleToggleActive = async (table) => {
    try {
      const updated = await tableApi.update(table.id, { is_active: !table.is_active })
      setTablesList((prev) => prev.map((t) => (t.id === table.id ? { ...t, ...updated } : t)))
      toast.success(`Table ${table.number} ${updated.is_active ? 'activated' : 'deactivated'}.`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update table status.'))
    }
  }

  // Duplicate table
  const handleDuplicate = async (table) => {
    const existingNums = new Set(tablesList.map((t) => String(t.number).trim()))
    let nextNum = parseInt(table.number, 10)
    let candidate = isNaN(nextNum) ? `${table.number}-copy` : String(nextNum + 1)
    while (existingNums.has(candidate)) {
      if (!isNaN(nextNum)) {
        nextNum += 1
        candidate = String(nextNum)
      } else {
        candidate = `${candidate}-copy`
      }
    }

    try {
      const payload = {
        number: candidate,
        label: table.label || '',
        seats: table.seats || 4,
        shape: table.shape || 'SQUARE',
        pos_x: (table.pos_x || 0) + 1,
        pos_y: table.pos_y || 0,
        is_active: true,
      }
      const created = await tableApi.create(payload)
      setTablesList((prev) => [...prev, created])
      toast.success(`Cloned Table ${table.number} → Table ${created.number}!`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to duplicate table.'))
    }
  }

  // Delete table
  const handleDeleteTable = async () => {
    if (!deleteConfirmTable) return
    setDeleting(true)
    try {
      await tableApi.remove(deleteConfirmTable.id)
      setTablesList((prev) => prev.filter((t) => t.id !== deleteConfirmTable.id))
      toast.success(`Table ${deleteConfirmTable.number} deleted successfully!`)
      setDeleteConfirmTable(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete table. Check if table has an active order.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* ── Top Header Navigation Bar ──────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/explore')}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Back to Explore Hub"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-sm shadow-red-500/25">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                  Table Management & Floor Layout
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Setup & Floor
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Add, edit, rearrange tables, manage zones & QR code menus
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                Table Cards
              </button>
              <button
                onClick={() => setViewMode('designer')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'designer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Floor Designer
              </button>
            </div>

            {/* Quick Link to POS Floor Map */}
            <button
              onClick={() => navigate('/tables')}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
            >
              Open Live Floor
            </button>

            {/* Bulk Setup Button */}
            <button
              onClick={() => setBulkModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors flex items-center gap-1"
            >
              <span>⚡</span> Bulk Setup
            </button>

            {/* Add Table Button */}
            <button
              onClick={() => setEditModalTable({})}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs shadow-red-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Table
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Tables</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{summary.total}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Seating</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{summary.totalSeats} <span className="text-xs font-semibold text-slate-400">Seats</span></div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Available</span>
            <div className="text-xl font-black text-emerald-700 mt-0.5">{summary.available}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Occupied</span>
            <div className="text-xl font-black text-rose-700 mt-0.5">{summary.occupied}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Billed</span>
            <div className="text-xl font-black text-amber-700 mt-0.5">{summary.billed}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Inactive</span>
            <div className="text-xl font-black text-slate-500 mt-0.5">{summary.inactive}</div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search table number or section name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Section Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedSection('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedSection === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All Sections ({tablesList.length})
            </button>
            {allSections.map((sec) => {
              const count = tablesList.filter((t) => t.label?.trim() === sec).length
              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedSection === sec
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {sec} ({count})
                </button>
              )
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="OCCUPIED">Occupied Only</option>
              <option value="BILLED">Billed Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* ── VIEW MODE 1: VISUAL FLOOR DESIGNER ────────────────────── */}
        {viewMode === 'designer' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>🎨</span> Interactive Floor Grid Designer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drag and reposition any table to arrange your floor plan. Changes snap to neat grid positions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoArrange}
                  disabled={autoArranging}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📐</span> Auto-Arrange Grid
                </button>

                <button
                  onClick={handleSaveLayout}
                  disabled={savingLayout || !dirtyLayout}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    dirtyLayout
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 animate-pulse cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {savingLayout ? 'Saving...' : dirtyLayout ? 'Save Layout Changes*' : 'Layout Saved'}
                </button>
              </div>
            </div>

            {dirtyLayout && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>⚠️ You have unsaved table position adjustments. Click "Save Layout Changes" above to persist.</span>
                <button
                  onClick={() => {
                    loadData()
                    setDirtyLayout(false)
                  }}
                  className="text-amber-700 hover:underline text-xs font-bold"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Visual Canvas */}
            <div className="overflow-x-auto pb-4">
              <div
                ref={gridContainerRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="relative bg-slate-50/70 border border-slate-200 rounded-2xl shadow-inner min-w-[900px] select-none"
                style={{
                  width: `${GRID_COLS * CELL_SIZE}px`,
                  height: `${GRID_ROWS * CELL_SIZE}px`,
                  backgroundImage: `radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)`,
                  backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                }}
              >
                {/* Tables placed on canvas */}
                {tablesList.map((t) => {
                  const posX = Math.max(0, Math.min(GRID_COLS - 1, t.pos_x ?? 0))
                  const posY = Math.max(0, Math.min(GRID_ROWS - 1, t.pos_y ?? 0))
                  const isAvailable = t.status === 'AVAILABLE'
                  const isBilled = t.status === 'BILLED'
                  const isOccupied = t.status === 'OCCUPIED'

                  let shapeRadius = 'rounded-2xl'
                  if (t.shape === 'ROUND') shapeRadius = 'rounded-full'

                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t)}
                      onClick={() => setEditModalTable(t)}
                      style={{
                        position: 'absolute',
                        left: `${posX * CELL_SIZE + 8}px`,
                        top: `${posY * CELL_SIZE + 8}px`,
                        width: `${CELL_SIZE - 16}px`,
                        height: `${CELL_SIZE - 16}px`,
                      }}
                      className={`${shapeRadius} bg-white border-2 shadow-sm hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing p-2.5 flex flex-col justify-between items-center text-center ${
                        !t.is_active
                          ? 'border-slate-300 opacity-40'
                          : isOccupied
                          ? 'border-rose-500 bg-rose-50/40'
                          : isBilled
                          ? 'border-amber-400 bg-amber-50/40'
                          : 'border-emerald-500 bg-emerald-50/40'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-slate-800">T-{t.number}</span>
                        <span
                          className={`size-2 rounded-full ${
                            !t.is_active
                              ? 'bg-slate-300'
                              : isOccupied
                              ? 'bg-rose-500'
                              : isBilled
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-semibold text-slate-400 truncate max-w-[80px]">
                          {t.label || 'General'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700">
                          {t.seats} <span className="text-[9px] font-medium text-slate-400">seats</span>
                        </span>
                      </div>

                      <div className="text-[8px] font-mono text-slate-400">
                        {t.shape}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW MODE 2: TABLE CARDS MANAGEMENT ───────────────────── */}
        {viewMode === 'cards' && (
          <div className="space-y-4">
            {filteredTables.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl">
                  🪑
                </div>
                <h3 className="text-sm font-bold text-slate-800">No tables match your filter</h3>
                <p className="text-xs text-slate-500">Try clearing your search query or switching section filters.</p>
                <button
                  onClick={() => {
                    setSearch('')
                    setSelectedSection('ALL')
                    setSelectedStatus('ALL')
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTables.map((table) => {
                  const isAvailable = table.status === 'AVAILABLE'
                  const isBilled = table.status === 'BILLED'
                  const isOccupied = table.status === 'OCCUPIED'

                  return (
                    <div
                      key={table.id}
                      className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                        !table.is_active
                          ? 'border-slate-200 opacity-60'
                          : isOccupied
                          ? 'border-rose-200 hover:border-rose-400'
                          : isBilled
                          ? 'border-amber-200 hover:border-amber-400'
                          : 'border-slate-200 hover:border-emerald-400'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="p-4 pb-3 border-b border-slate-100 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white ${
                              !table.is_active
                                ? 'bg-slate-400'
                                : isOccupied
                                ? 'bg-rose-600 shadow-xs shadow-rose-600/30'
                                : isBilled
                                ? 'bg-amber-500 shadow-xs shadow-amber-500/30'
                                : 'bg-slate-900 shadow-xs'
                            }`}
                          >
                            T{table.number}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-extrabold text-sm text-slate-900">
                                Table {table.number}
                              </h3>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {table.shape || 'SQUARE'}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">
                              {table.label || 'Main Dining'}
                            </span>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${
                              !table.is_active
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : isOccupied
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isBilled
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                !table.is_active
                                  ? 'bg-slate-400'
                                  : isOccupied
                                  ? 'bg-rose-500'
                                  : isBilled
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            {!table.is_active ? 'INACTIVE' : table.status}
                          </span>
                        </div>
                      </div>

                      {/* Middle Details */}
                      <div className="p-4 py-3 space-y-2.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Capacity:</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                            {table.seats} Seats
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Grid Position:</span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            ({table.pos_x ?? 0}, {table.pos_y ?? 0})
                          </span>
                        </div>

                        {table.running_total && (
                          <div className="flex items-center justify-between bg-rose-50/80 -mx-1 px-2 py-1 rounded-lg">
                            <span className="text-rose-700 font-semibold text-[11px]">Running Bill:</span>
                            <span className="font-black text-rose-800 text-xs">
                              ₹{Number(table.running_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                        {/* Quick Active Toggle */}
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={table.is_active}
                            onChange={() => handleToggleActive(table)}
                            className="size-3.5 accent-red-600 rounded cursor-pointer"
                          />
                          Active
                        </label>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          {/* QR Code */}
                          <button
                            onClick={() => setQrModalTable(table)}
                            title="Generate / Print Table QR Code"
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75z" />
                            </svg>
                          </button>

                          {/* Clone/Duplicate */}
                          <button
                            onClick={() => handleDuplicate(table)}
                            title="Duplicate Table"
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          </button>

                          {/* Transfer (if occupied) */}
                          {isOccupied && (
                            <button
                              onClick={() => setTransferTable(table)}
                              title="Transfer Order to another Table"
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                              </svg>
                            </button>
                          )}

                          {/* Edit Details */}
                          <button
                            onClick={() => setEditModalTable(table)}
                            title="Edit Table Configuration"
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirmTable(table)}
                            title="Delete Table"
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL 1: ADD / EDIT TABLE MODAL ───────────────────────── */}
      {editModalTable !== null && (
        <TableEditModal
          table={editModalTable}
          existingSections={allSections}
          existingNumbers={tablesList.map((t) => String(t.number))}
          onClose={() => setEditModalTable(null)}
          onSuccess={(saved) => {
            setEditModalTable(null)
            loadData()
          }}
        />
      )}

      {/* ── MODAL 2: BULK SETUP TABLES MODAL ──────────────────────── */}
      {bulkModalOpen && (
        <BulkSetupModal
          existingSections={allSections}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={() => {
            setBulkModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* ── MODAL 3: TABLE QR CODE & PRINT TENT CARD ──────────────── */}
      {qrModalTable && (
        <TableQrModal
          table={qrModalTable}
          onClose={() => setQrModalTable(null)}
        />
      )}

      {/* ── MODAL 4: TRANSFER ORDER MODAL ─────────────────────────── */}
      {transferTable && (
        <TransferModal
          table={transferTable}
          onClose={() => setTransferTable(null)}
          onSuccess={() => {
            setTransferTable(null)
            loadData()
          }}
        />
      )}

      {/* ── MODAL 5: DELETE CONFIRMATION MODAL ────────────────────── */}
      {deleteConfirmTable && (
        <Modal
          open
          onClose={() => setDeleteConfirmTable(null)}
          title={`Delete Table ${deleteConfirmTable.number}?`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirmTable(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteTable} loading={deleting}>
                Confirm Delete
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-slate-600">
            <p>
              Are you sure you want to permanently delete <strong>Table {deleteConfirmTable.number}</strong> ({deleteConfirmTable.label || 'General'})?
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
              <strong>Notice:</strong> Tables with active running orders or unpaid bills cannot be deleted. If you only want to take this table out of service temporarily, use the <em>Inactive</em> toggle instead.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ─── COMPONENT: Table Edit Modal ──────────────────────────────────── */
function TableEditModal({ table, existingSections, existingNumbers, onClose, onSuccess }) {
  const isEdit = Boolean(table?.id)
  const toast = useToast()

  const [number, setNumber] = useState(table?.number || '')
  const [section, setSection] = useState(table?.label || '')
  const [customSection, setCustomSection] = useState('')
  const [seats, setSeats] = useState(table?.seats || 4)
  const [shape, setShape] = useState(table?.shape || 'SQUARE')
  const [isActive, setIsActive] = useState(table?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cleanNum = String(number).trim()
    if (!cleanNum) {
      setError('Table number is required.')
      return
    }

    if (!isEdit && existingNumbers.includes(cleanNum)) {
      setError(`Table number "${cleanNum}" already exists.`)
      return
    }

    const finalLabel = customSection.trim() || section.trim()

    setSubmitting(true)
    try {
      const payload = {
        number: cleanNum,
        label: finalLabel,
        seats: Number(seats),
        shape,
        is_active: isActive,
      }

      if (isEdit) {
        await tableApi.update(table.id, payload)
        toast.success(`Table ${cleanNum} updated!`)
      } else {
        await tableApi.create(payload)
        toast.success(`Table ${cleanNum} created!`)
      }
      onSuccess()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save table.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit Table ${table.number}` : 'Add New Table'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Table'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Table Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 21, T-21, VIP-1"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Seats Capacity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              required
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        {/* Quick Seats Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-semibold text-[10px]">Quick Seats:</span>
          {[2, 4, 6, 8, 10].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeats(s)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                Number(seats) === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Section / Zone */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Section / Floor Zone</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value)
                setCustomSection('')
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="">Select Existing...</option>
              {existingSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Or type new section..."
              value={customSection}
              onChange={(e) => {
                setCustomSection(e.target.value)
                setSection('')
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        {/* Table Shape */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Table Shape</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'SQUARE', name: 'Square', radius: 'rounded-lg' },
              { id: 'ROUND', name: 'Round', radius: 'rounded-full' },
              { id: 'RECT', name: 'Rectangle', radius: 'rounded-lg' },
            ].map((sh) => (
              <button
                key={sh.id}
                type="button"
                onClick={() => setShape(sh.id)}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  shape === sh.id
                    ? 'border-red-600 bg-red-50 text-red-700 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`border-2 border-current ${sh.radius} ${
                    sh.id === 'RECT' ? 'w-7 h-4' : 'w-5 h-5'
                  }`}
                />
                <span className="text-[11px]">{sh.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Toggle */}
        <label className="flex items-center gap-2 pt-1 font-semibold text-slate-700 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-red-600 rounded cursor-pointer"
          />
          Table is active and available for billing
        </label>
      </form>
    </Modal>
  )
}

/* ─── COMPONENT: Bulk Setup Modal ──────────────────────────────────── */
function BulkSetupModal({ existingSections, onClose, onSuccess }) {
  const toast = useToast()
  const [count, setCount] = useState(5)
  const [seats, setSeats] = useState(4)
  const [startFrom, setStartFrom] = useState(1)
  const [section, setSection] = useState('Main Dining')
  const [customSection, setCustomSection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const finalSection = customSection.trim() || section.trim()
      await tableApi.bulkCreate({
        count: Number(count),
        seats: Number(seats),
        start_from: Number(startFrom),
        label: finalSection,
      })
      toast.success(`Successfully generated ${count} tables!`)
      onSuccess()
    } catch (err) {
      setError(errorMessage(err, 'Bulk table creation failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="⚡ Bulk Setup Tables"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleBulkSubmit} loading={submitting}>
            Generate {count} Tables
          </Button>
        </>
      }
    >
      <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
        <p className="text-slate-500">
          Quickly generate multiple tables sequentially with automatic grid layout.
        </p>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              max="50"
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Seats / Table</label>
            <input
              type="number"
              min="1"
              max="30"
              required
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Start Number</label>
            <input
              type="number"
              min="1"
              required
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Assign Section</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value)
                setCustomSection('')
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="Main Dining">Main Dining</option>
              {existingSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Or custom section..."
              value={customSection}
              onChange={(e) => {
                setCustomSection(e.target.value)
                setSection('')
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

/* ─── COMPONENT: Table QR Code Modal & Print Tent Card ─────────────── */
function TableQrModal({ table, onClose }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    `${window.location.origin}/feedback/T${table.number}`
  )}`

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Table ${table.number} QR Standee</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; margin: 0; }
            .card { border: 2px dashed #e2e8f0; border-radius: 24px; padding: 30px; max-width: 320px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .brand { font-size: 14px; font-weight: 800; color: #dc2626; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
            .title { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0; }
            .section { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 20px; }
            .qr { width: 220px; height: 220px; border-radius: 16px; margin: 0 auto; border: 1px solid #f1f5f9; padding: 8px; }
            .cta { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 18px; }
            .subtext { font-size: 11px; color: #94a3b8; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">ReBill POS</div>
            <div class="title">Table ${table.number}</div>
            <div class="section">${table.label || 'Dining Area'} • ${table.seats} Seats</div>
            <img class="qr" src="${qrUrl}" alt="Table ${table.number} QR" />
            <div class="cta">Scan for Digital Menu & Instant Bill</div>
            <div class="subtext">Scan with any phone camera or UPI app</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Table ${table.number} QR Code`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint} className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.077-.32-2.19-.32-3.329 0-4.97 4.03-9 9-9s9 4.03 9 9c0 1.139-.08 2.252-.32 3.329M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-18 0h18M5.25 12h13.5" />
            </svg>
            Print Table Tent Card
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center space-y-4 py-2">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl shadow-inner inline-block">
          <img
            src={qrUrl}
            alt={`Table ${table.number} QR`}
            className="w-48 h-48 rounded-xl bg-white p-2 border border-slate-100 shadow-xs"
          />
        </div>

        <div>
          <div className="text-base font-black text-slate-900">Table {table.number}</div>
          <div className="text-xs font-semibold text-slate-500">
            {table.label || 'General'} • {table.seats} Seats
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-xs">
            Customers can scan this QR code with their mobile phone to view the live digital menu or check bill status.
          </p>
        </div>
      </div>
    </Modal>
  )
}
