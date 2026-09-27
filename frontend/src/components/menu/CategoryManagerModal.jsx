import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { categories as categoryApi } from '@/services/menu'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'

export default function CategoryManagerModal({ categories, onClose, onRefresh }) {
  const toast = useToast()
  const [cats, setCats] = useState([...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
  const [newCatName, setNewCatName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [savingReorder, setSavingReorder] = useState(false)

  const handleCreate = async (e) => {
    e?.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await categoryApi.create({
        name,
        sort_order: cats.length,
        is_active: true,
      })
      setCats([...cats, created])
      setNewCatName('')
      toast.success(`Category "${name}" created!`)
      onRefresh?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create category.'))
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (id) => {
    const name = editingName.trim()
    if (!name) return
    setBusyId(id)
    try {
      const updated = await categoryApi.update(id, { name })
      setCats(cats.map((c) => (c.id === id ? { ...c, name: updated.name } : c)))
      setEditingId(null)
      toast.success('Category updated!')
      onRefresh?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update category.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleActive = async (cat) => {
    setBusyId(cat.id)
    try {
      const res = await categoryApi.toggleActive(cat.id)
      setCats(cats.map((c) => (c.id === cat.id ? { ...c, is_active: res.is_active } : c)))
      toast.success(`Category "${cat.name}" is now ${res.is_active ? 'Active' : 'Inactive'}`)
      onRefresh?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to toggle category status.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (cat) => {
    if (cat.item_count > 0) {
      toast.error(`Cannot delete "${cat.name}" because it contains ${cat.item_count} items. Move or delete them first.`)
      return
    }
    if (!window.confirm(`Delete category "${cat.name}"?`)) return
    setBusyId(cat.id)
    try {
      await categoryApi.remove(cat.id)
      setCats(cats.filter((c) => c.id !== cat.id))
      toast.success(`Category "${cat.name}" deleted.`)
      onRefresh?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete category.'))
    } finally {
      setBusyId(null)
    }
  }

  const moveCategory = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= cats.length) return
    const newCats = [...cats]
    const temp = newCats[index]
    newCats[index] = newCats[targetIndex]
    newCats[targetIndex] = temp

    // Update sort_orders
    const updated = newCats.map((c, idx) => ({ ...c, sort_order: idx }))
    setCats(updated)

    setSavingReorder(true)
    try {
      await categoryApi.reorder(updated.map((c) => ({ id: c.id, sort_order: c.sort_order })))
      onRefresh?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save category order.'))
    } finally {
      setSavingReorder(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="🗂️ Category Manager"
      subtitle="Organize, reorder, or temporarily disable menu categories"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400 font-medium">
            {cats.length} total categories {savingReorder && '· Saving order...'}
          </span>
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Create New Category Form */}
        <form onSubmit={handleCreate} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New Category Name (e.g. Tandoori Starters, Beverages)"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
          />
          <Button type="submit" loading={creating} disabled={!newCatName.trim()}>
            + Add Category
          </Button>
        </form>

        {/* Categories List */}
        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl bg-white overflow-hidden max-h-[55vh] overflow-y-auto">
          {cats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm font-medium">
              No categories yet. Create your first category above!
            </div>
          ) : (
            cats.map((cat, idx) => (
              <div
                key={cat.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                  !cat.is_active ? 'bg-slate-50/60 opacity-75' : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Reorder Buttons & Icon */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0 || busyId === cat.id}
                      onClick={() => moveCategory(idx, -1)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === cats.length - 1 || busyId === cat.id}
                      onClick={() => moveCategory(idx, 1)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-300 w-5 text-center">
                    {idx + 1}
                  </span>
                </div>

                {/* Name / Inline Edit */}
                <div className="flex-1 min-w-0">
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(cat.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdate(cat.id)}
                        disabled={busyId === cat.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {cat.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {cat.item_count ?? 0} items
                      </span>
                      {!cat.is_active && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Inactive (Hidden in POS)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(cat)}
                    disabled={busyId === cat.id}
                    title={cat.is_active ? 'Disable Category' : 'Enable Category'}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all ${
                      cat.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {cat.is_active ? 'Active' : 'Disabled'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(cat.id)
                      setEditingName(cat.name)
                    }}
                    title="Rename"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    disabled={busyId === cat.id}
                    title="Delete Category"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
