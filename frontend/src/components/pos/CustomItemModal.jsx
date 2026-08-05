import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { FoodTypeDot } from '@/components/ui/Misc'

export default function CustomItemModal({ open, onClose, onAdd }) {
  const [customName, setCustomName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [portion, setPortion] = useState('FULL')
  const [foodType, setFoodType] = useState('VEG')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customName.trim()) {
      setError('Please enter item name.')
      return
    }
    if (!unitPrice || Number(unitPrice) < 0) {
      setError('Please enter a valid price.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await onAdd({
        custom_name: customName.trim(),
        unit_price: unitPrice.toString(),
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        portion,
        food_type: foodType,
        note: note.trim(),
      })
      // Reset form
      setCustomName('')
      setUnitPrice('')
      setQuantity(1)
      setPortion('FULL')
      setFoodType('VEG')
      setNote('')
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to add custom item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Custom Item" subtitle="For special items not listed in the menu" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        {/* Item Name */}
        <div>
          <Label htmlFor="custom_name" required>Item Name</Label>
          <Input
            id="custom_name"
            type="text"
            placeholder="e.g. Special Paan, Custom Salad..."
            value={customName}
            onChange={(e) => { setCustomName(e.target.value); setError('') }}
            autoFocus
            className="w-full font-semibold"
          />
        </div>

        {/* Price & Quantity Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="unit_price" required>Price / Rate (₹)</Label>
            <Input
              id="unit_price"
              type="number"
              min="0"
              step="1"
              placeholder="0.00"
              value={unitPrice}
              onChange={(e) => { setUnitPrice(e.target.value); setError('') }}
              className="w-full font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="size-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-black text-slate-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="size-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Food Type & Portion selection */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Food Type */}
          <div>
            <Label>Food Type</Label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setFoodType('VEG')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${foodType === 'VEG' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                <FoodTypeDot foodType="VEG" /> Veg
              </button>
              <button
                type="button"
                onClick={() => setFoodType('NON_VEG')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${foodType === 'NON_VEG' ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                <FoodTypeDot foodType="NON_VEG" /> Non-Veg
              </button>
            </div>
          </div>

          {/* Portion */}
          <div>
            <Label>Portion</Label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setPortion('FULL')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${portion === 'FULL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                Full
              </button>
              <button
                type="button"
                onClick={() => setPortion('HALF')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${portion === 'HALF' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                Half
              </button>
            </div>
          </div>
        </div>

        {/* Note for kitchen */}
        <div>
          <Label htmlFor="note">Kitchen / Packing Note (Optional)</Label>
          <Input
            id="note"
            type="text"
            placeholder="e.g. Extra spicy, parcel packing..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-xs"
          />
        </div>

        {/* Modal Buttons */}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
            + Add to Order
          </Button>
        </div>
      </form>
    </Modal>
  )
}
