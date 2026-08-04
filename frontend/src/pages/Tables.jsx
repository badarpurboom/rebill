import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { tables as tableApi, TABLE_STATUS } from '@/services/tables'
import { money } from '@/utils/format'
import Button from '@/components/ui/Button'
import { EmptyState, PageLoader } from '@/components/ui/Misc'
import FloorMap, { FloorLegend } from '@/components/tables/FloorMap'
import TableFormModal from '@/components/tables/TableFormModal'
import TableConfirmModal from '@/components/tables/TableConfirmModal'

/* ─── Helpers ─────────────────────────────────────────────────────── */
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function shiftLabel() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning Shift'
  if (h < 17) return 'Lunch Shift'
  return 'Dinner Shift'
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function Tables() {
  const { isOwner } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formTable, setFormTable] = useState(null)
  const [liveMode, setLiveMode] = useState(false)
  const [pendingTable, setPendingTable] = useState(null)   // Table awaiting confirmation

  /* Load */
  const load = useCallback(async () => {
    try {
      setRows(await tableApi.list())
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load floor map.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  /* Auto-refresh */
  useEffect(() => {
    if (editing) return
    const id = setInterval(() => tableApi.list().then(setRows).catch(() => {}), 15_000)
    return () => clearInterval(id)
  }, [editing])

  /* Derived */
  const summary = useMemo(() => {
    const c = { AVAILABLE: 0, OCCUPIED: 0, BILLED: 0 }
    for (const t of rows) c[t.status] = (c[t.status] ?? 0) + 1
    return c
  }, [rows])

  const activeCount = useMemo(
    () => rows.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILLED').length,
    [rows],
  )

  const floorTotal = useMemo(
    () => rows.reduce((s, t) => s + Number(t.running_total ?? 0), 0),
    [rows],
  )

  /* Layout drag */
  const moveTable = (id, pos_x, pos_y) => {
    setRows((cur) => cur.map((t) => (t.id === id ? { ...t, pos_x, pos_y } : t)))
    setDirty(true)
  }

  const saveLayout = async () => {
    setSaving(true)
    try {
      await tableApi.saveLayout(rows.map(({ id, pos_x, pos_y }) => ({ id, pos_x, pos_y })))
      setDirty(false)
      setEditing(false)
      toast.success('Floor layout saved!')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save layout.'))
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = async () => {
    if (dirty && !window.confirm('Unsaved layout changes will be lost. Continue?')) return
    setEditing(false)
    setDirty(false)
    await load()
  }

  /* Open table in POS */
  const openTable = (table) => {
    if (!table.is_active) { toast.info(`Table ${table.number} is inactive.`); return }

    // OCCUPIED / BILLED — order already running, navigate directly (no risk of accidental occupation)
    if (table.status === 'OCCUPIED' || table.status === 'BILLED') {
      navigate(`/pos?table=${table.id}`)
      return
    }

    // AVAILABLE — show confirmation modal before marking table as occupied
    setPendingTable(table)
  }

  if (loading) return <PageLoader label="Loading floor map…" />

  const activeLabel = `${activeCount}/${rows.length} Tables Active`

  return (
    <div className="space-y-5">

      {/* ── Header Card (matches Stitch "Main Dining Room" header) ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

          {/* Left: Title + subtitle */}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Main Dining Room</h1>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {shiftLabel()} &nbsp;•&nbsp;
              <span className="font-bold text-slate-700">{activeLabel}</span>
            </p>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date pill */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {todayLabel()}
            </div>

            {/* Live View toggle */}
            <button
              onClick={() => setLiveMode((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                liveMode
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
              </svg>
              Live View
            </button>

            {/* Owner controls */}
            {isOwner && rows.length > 0 && (
              editing ? (
                <>
                  <Button variant="secondary" onClick={cancelEdit} disabled={saving} className="rounded-xl font-bold text-sm">
                    Cancel
                  </Button>
                  <Button onClick={saveLayout} loading={saving} disabled={!dirty} className="rounded-xl font-black text-sm bg-rose-600 text-white">
                    {dirty ? 'Save Layout' : 'No Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setFormTable({})} className="rounded-xl font-bold text-sm border-slate-200">
                    + Add Table
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(true)} className="rounded-xl font-bold text-sm border-slate-200">
                    ✥ Arrange
                  </Button>
                </>
              )
            )}
          </div>
        </div>

        {/* Legend row */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between border-t border-slate-100 pt-4">
          <FloorLegend summary={summary} />
          {floorTotal > 0 && (
            <div className="text-xs font-bold text-slate-500">
              Floor Total: <span className="font-black text-slate-900">{money(floorTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Mode Banner ── */}
      {editing && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 flex items-center gap-2">
          <span className="animate-pulse">✥</span>
          <span>Drag tables to rearrange floor layout. Click <strong>Save Layout</strong> when done.</span>
        </div>
      )}

      {/* ── Floor Map / Card Grid ── */}
      {rows.length === 0 ? (
        <EmptyState
          icon="🪑"
          title="No tables configured"
          hint="Add tables to set up your restaurant floor map."
          action={
            isOwner ? (
              <Button onClick={() => setFormTable({})} className="bg-rose-600 text-white font-bold rounded-xl">
                + Add First Table
              </Button>
            ) : null
          }
        />
      ) : (
        <FloorMap
          tables={rows}
          editing={editing}
          onTableClick={openTable}
          onLayoutChange={moveTable}
        />
      )}

      {/* ── Quick Config Chips (owner only, non-edit mode) ── */}
      {isOwner && !editing && rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mb-3">
            Quick Table Config
          </h2>
          <div className="flex flex-wrap gap-2">
            {rows.map((t) => {
              const cfg = { AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200', OCCUPIED: 'bg-rose-50 text-rose-700 border-rose-200', BILLED: 'bg-amber-50 text-amber-700 border-amber-200' }
              return (
                <button
                  key={t.id}
                  onClick={() => setFormTable(t)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all hover:scale-105 active:scale-95 ${cfg[t.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'} ${!t.is_active ? 'line-through opacity-40' : ''}`}
                >
                  T-{String(t.number).padStart(2,'0')} · {t.seats}S
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Table Form Modal ── */}
      {formTable !== null && (
        <TableFormModal
          table={formTable.id ? formTable : null}
          onClose={() => setFormTable(null)}
          onSaved={(saved, wasNew) => {
            setRows((cur) =>
              wasNew ? [...cur, saved] : cur.map((t) => (t.id === saved.id ? saved : t)),
            )
            setFormTable(null)
            toast.success(`Table ${saved.number} ${wasNew ? 'added' : 'updated'}.`)
          }}
          onDeleted={(deleted) => {
            setRows((cur) => cur.filter((t) => t.id !== deleted.id))
            setFormTable(null)
            toast.success(`Table ${deleted.number} removed.`)
          }}
        />
      )}

      {/* ── Table Open Confirmation Modal (AVAILABLE tables only) ── */}
      {pendingTable && (
        <TableConfirmModal
          table={pendingTable}
          onConfirm={(table) => {
            setPendingTable(null)
            navigate(`/pos?table=${table.id}`)
          }}
          onCancel={() => setPendingTable(null)}
        />
      )}
    </div>
  )
}
