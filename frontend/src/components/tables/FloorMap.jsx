import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ─── Drag-and-Drop Canvas (Edit Mode only) ────────────────────────── */
const CELL = 116
const TILE = 100
const MIN_COLUMNS = 6
const MIN_ROWS = 4
const SHAPE_CLASS = { SQUARE: 'rounded-xl', ROUND: 'rounded-full', RECT: 'rounded-xl' }

const STATUS_CFG = {
  AVAILABLE: {
    border: 'border-l-emerald-400',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    label: 'AVAILABLE',
  },
  OCCUPIED: {
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-600 border border-rose-200',
    label: 'OCCUPIED',
  },
  BILLED: {
    border: 'border-l-amber-400',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-600 border border-amber-200',
    label: 'BILLED',
  },
}

/* ─── Card View (Normal Mode — matches Stitch design) ──────────────── */
function TableCard({ table, onClick, onPayClick, onTransferClick, onVoidClick }) {
  const cfg = STATUS_CFG[table.status] ?? STATUS_CFG.AVAILABLE
  const num = String(table.number).padStart(2, '0')
  const bill = table.running_total
    ? `₹${Number(table.running_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '–'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(table)}
      className={[
        'group w-full text-left bg-white rounded-xl border border-slate-200 border-l-4 shadow-sm',
        'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]',
        cfg.border,
        !table.is_active ? 'opacity-40 pointer-events-none' : '',
      ].join(' ')}
    >
      <div className="p-4">
        {/* Row 1: Table number + Status badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[15px] font-black text-slate-900 tracking-tight">T-{num}</span>
          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${cfg.badge}`}>
            <span className={`size-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Row 2: Seat count */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <svg className="size-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span className="font-semibold">{table.seats} Seats</span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 mb-3" />

        {/* Row 3: Current Bill + Time Seated */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
              Current Bill
            </p>
            <p className="text-sm font-black text-slate-900">{bill}</p>
          </div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
              Time Seated
            </p>
            <p className="text-sm font-semibold text-slate-600 flex items-center gap-1">
              {table.time_seated ? (
                <>
                  <svg className="size-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 6v6l4 2" />
                  </svg>
                  {table.time_seated}
                </>
              ) : (
                <span className="text-slate-400">–</span>
              )}
            </p>
          </div>
        </div>

        {(table.status === 'BILLED' || table.status === 'OCCUPIED') && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPayClick?.(e, table);
              }}
              className="flex-1 bg-rose-600 text-white rounded-lg py-1.5 text-xs font-bold shadow-md hover:bg-rose-700 active:scale-95 transition-all"
            >
              Pay Bill
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTransferClick?.(e, table);
              }}
              title="Transfer Table"
              className="px-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVoidClick?.(e, table);
              }}
              title="Cancel / Clear Table Order"
              className="px-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg shadow-sm hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Canvas Mode (Edit / Arrange Layout) ──────────────────────────── */
function CanvasMode({ tables, selectedId, onTableClick, onLayoutChange }) {
  const surfaceRef = useRef(null)
  const [drag, setDrag] = useState(null)

  const { columns, rows } = useMemo(() => {
    const maxX = tables.reduce((m, t) => Math.max(m, t.pos_x), 0)
    const maxY = tables.reduce((m, t) => Math.max(m, t.pos_y), 0)
    return { columns: Math.max(MIN_COLUMNS, maxX + 2), rows: Math.max(MIN_ROWS, maxY + 2) }
  }, [tables])

  const occupied = useMemo(() => {
    const map = new Map()
    for (const t of tables) map.set(`${t.pos_x},${t.pos_y}`, t.id)
    return map
  }, [tables])

  const startDrag = (e, table) => {
    e.preventDefault()
    const surface = surfaceRef.current.getBoundingClientRect()
    setDrag({
      id: table.id,
      dx: e.clientX - (surface.left + table.pos_x * CELL),
      dy: e.clientY - (surface.top + table.pos_y * CELL),
      x: table.pos_x * CELL,
      y: table.pos_y * CELL,
    })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = useCallback((e) => {
    if (!drag) return
    const surface = surfaceRef.current.getBoundingClientRect()
    setDrag((d) => ({ ...d, x: e.clientX - surface.left - d.dx, y: e.clientY - surface.top - d.dy }))
  }, [drag])

  const endDrag = useCallback(() => {
    if (!drag) return
    const cellX = Math.max(0, Math.min(columns - 1, Math.round(drag.x / CELL)))
    const cellY = Math.max(0, Math.min(rows - 1, Math.round(drag.y / CELL)))
    const taker = occupied.get(`${cellX},${cellY}`)
    if (taker === undefined || taker === drag.id) onLayoutChange?.(drag.id, cellX, cellY)
    setDrag(null)
  }, [drag, columns, rows, occupied, onLayoutChange])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => { window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', endDrag) }
  }, [drag, endDrag])

  return (
    <div className="scroll-thin overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 min-h-[440px]">
      <div
        ref={surfaceRef}
        onPointerMove={onMove}
        className="relative"
        style={{
          width: columns * CELL,
          height: rows * CELL,
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: `${CELL}px ${CELL}px`,
          backgroundPosition: `${CELL / 2}px ${CELL / 2}px`,
        }}
      >
        {tables.map((table) => {
          const dragging = drag?.id === table.id
          const cfg = STATUS_CFG[table.status] ?? STATUS_CFG.AVAILABLE
          const left = dragging ? drag.x : table.pos_x * CELL
          const top = dragging ? drag.y : table.pos_y * CELL
          const tileW = table.shape === 'RECT' ? TILE * 1.65 : TILE

          return (
            <div
              key={table.id}
              className="absolute"
              style={{ left, top, width: tileW, height: TILE, transition: dragging ? 'none' : 'left 120ms, top 120ms' }}
            >
              <button
                type="button"
                onPointerDown={(e) => startDrag(e, table)}
                onClick={() => onTableClick?.(table)}
                className={[
                  'h-full w-full flex flex-col justify-between p-2.5 border-2 bg-white text-left transition-all',
                  SHAPE_CLASS[table.shape] ?? 'rounded-xl',
                  `border-l-4 ${cfg.border} border-t-slate-200 border-r-slate-200 border-b-slate-200`,
                  'cursor-grab active:cursor-grabbing shadow-sm',
                  dragging ? 'scale-105 shadow-xl z-20' : '',
                  selectedId === table.id ? 'ring-2 ring-rose-500' : '',
                ].join(' ')}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-black text-slate-900">T-{String(table.number).padStart(2,'0')}</span>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500">{table.seats} Seats</div>
                {table.running_total ? (
                  <div className="text-xs font-black text-slate-900">
                    ₹{Number(table.running_total).toLocaleString('en-IN')}
                  </div>
                ) : null}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main FloorMap Component ──────────────────────────────────────── */
export default function FloorMap({ tables, editing = false, selectedId = null, onTableClick, onLayoutChange, onPayClick, onTransferClick, onVoidClick }) {
  if (editing) {
    return (
      <CanvasMode
        tables={tables}
        selectedId={selectedId}
        onTableClick={onTableClick}
        onLayoutChange={onLayoutChange}
      />
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} onClick={onTableClick} onPayClick={onPayClick} onTransferClick={onTransferClick} onVoidClick={onVoidClick} />
      ))}
    </div>
  )
}

/* ─── Legend Strip ─────────────────────────────────────────────────── */
export function FloorLegend({ summary }) {
  const items = [
    { key: 'AVAILABLE', label: 'Available', dot: 'bg-emerald-500' },
    { key: 'OCCUPIED',  label: 'Occupied',  dot: 'bg-rose-500'   },
    { key: 'BILLED',    label: 'Billed',    dot: 'bg-amber-400'  },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
      {items.map(({ key, label, dot }) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${dot}`} />
          {label}
          {summary && (
            <span className="font-black text-slate-900 ml-0.5">{summary[key] ?? 0}</span>
          )}
        </span>
      ))}
    </div>
  )
}
