import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/services/api'
import { items as itemApi, categories as categoryApi } from '@/services/menu'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { FoodTypeDot } from '@/components/ui/Misc'
import { money } from '@/utils/format'

const priceRule = {
  required: 'Price is required',
  min: { value: 0, message: 'Price cannot be negative' },
}

export default function ItemFormModal({ item, categories: initialCategories, onClose, onSaved, onCategoryCreated }) {
  const isEdit = Boolean(item?.id)
  const existingHalf = item?.variants?.find((v) => v.portion === 'HALF')
  const existingFull = item?.variants?.find((v) => v.portion === 'FULL')

  const [categories, setCategories] = useState(initialCategories)
  const [hasHalf, setHasHalf] = useState(Boolean(existingHalf))
  const [formError, setFormError] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: item?.name ?? '',
      category: item?.category ?? initialCategories[0]?.id ?? '',
      food_type: item?.food_type ?? 'VEG',
      description: item?.description ?? '',
      is_available: item?.is_available ?? true,
      half_price: existingHalf?.price ?? '',
      full_price: existingFull?.price ?? '',
    },
  })

  const formName = watch('name')
  const formCategory = watch('category')
  const formFoodType = watch('food_type')
  const formDescription = watch('description')
  const formFullPrice = watch('full_price')
  const formHalfPrice = watch('half_price')
  const formIsAvailable = watch('is_available')

  const selectedCategoryObj = categories.find((c) => String(c.id) === String(formCategory))

  const handleQuickAddCategory = async (e) => {
    e?.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const created = await categoryApi.create({
        name,
        sort_order: categories.length,
        is_active: true,
      })
      const updatedList = [...categories, created]
      setCategories(updatedList)
      setValue('category', created.id)
      setNewCatName('')
      setShowAddCat(false)
      onCategoryCreated?.(created)
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create category.'))
    } finally {
      setAddingCat(false)
    }
  }

  const onSubmit = async (values) => {
    setFormError('')
    const variants = [{ portion: 'FULL', price: values.full_price }]
    if (hasHalf && values.half_price) {
      variants.unshift({ portion: 'HALF', price: values.half_price })
    }

    const payload = {
      name: values.name.trim(),
      category: Number(values.category),
      food_type: values.food_type,
      description: values.description.trim(),
      is_available: values.is_available === true || values.is_available === 'true',
      variants,
    }

    try {
      const saved = isEdit
        ? await itemApi.update(item.id, payload)
        : await itemApi.create(payload)
      onSaved(saved, !isEdit)
    } catch (error) {
      setFormError(errorMessage(error, 'Failed to save item.'))
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={isEdit ? '✏️ Edit Dish' : '✨ Add New Dish'}
      subtitle={isEdit ? `Modifying "${item.name}"` : 'Add dish details, portion pricing, and category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="item-form" type="submit" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Dish'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Form */}
        <form id="item-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 lg:col-span-7">
          {/* Dish Name */}
          <FormRow label="Dish Name" required htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              autoFocus
              placeholder="e.g. Paneer Butter Masala, Crispy Corn"
              error={errors.name}
              {...register('name', {
                required: 'Dish name is required',
                maxLength: { value: 120, message: 'Name cannot exceed 120 characters' },
              })}
            />
          </FormRow>

          {/* Category & Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Category <span className="text-rose-500">*</span>
              </label>
              {!showAddCat && (
                <button
                  type="button"
                  onClick={() => setShowAddCat(true)}
                  className="text-xs font-black text-rose-600 hover:text-rose-700 hover:underline"
                >
                  + Quick Add Category
                </button>
              )}
            </div>

            {showAddCat ? (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-rose-200 rounded-xl mb-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New Category Name"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-100"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleQuickAddCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {addingCat ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCat(false); setNewCatName('') }}
                  className="px-2 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            ) : null}

            <select
              id="category"
              {...register('category', { required: 'Please select a category' })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{errors.category.message}</p>
            )}
          </div>

          {/* Food Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Dietary Food Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formFoodType === 'VEG'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="VEG"
                  {...register('food_type')}
                  className="sr-only"
                />
                <FoodTypeDot foodType="VEG" className="size-4 shrink-0" />
                <span className="text-xs font-extrabold text-emerald-950">Pure Veg</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formFoodType === 'NON_VEG'
                    ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="NON_VEG"
                  {...register('food_type')}
                  className="sr-only"
                />
                <FoodTypeDot foodType="NON_VEG" className="size-4 shrink-0" />
                <span className="text-xs font-extrabold text-rose-950">Non-Veg</span>
              </label>
            </div>
          </div>

          {/* Portion Pricing Section */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Portion & Pricing (₹)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Tax inclusive pricing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Portion */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Full Portion Price <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="260"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-sm font-black text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    {...register('full_price', priceRule)}
                  />
                </div>
                {errors.full_price && (
                  <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.full_price.message}</p>
                )}
              </div>

              {/* Half Portion (Optional) */}
              <div className={`p-3 rounded-xl border transition-all ${hasHalf ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-100/60 border-slate-200/60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHalf}
                      onChange={(e) => setHasHalf(e.target.checked)}
                      className="accent-rose-600 size-3.5 rounded"
                    />
                    Half Portion
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">Optional</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={hasHalf ? '150' : 'Disabled'}
                    disabled={!hasHalf}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-sm font-black text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-40"
                    {...register('half_price', hasHalf ? priceRule : {})}
                  />
                </div>
                {hasHalf && errors.half_price && (
                  <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.half_price.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <FormRow label="Short Description (Optional)" htmlFor="description">
            <Input
              id="description"
              placeholder="e.g. Fresh cottage cheese cubes tossed in spicy tandoori masala"
              {...register('description')}
            />
          </FormRow>

          {/* Availability Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <div>
              <p className="text-xs font-bold text-slate-800">Dish Available in POS</p>
              <p className="text-[11px] text-slate-400">Turn off if temporarily out of ingredients</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                {...register('is_available')}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {formError}
            </p>
          )}
        </form>

        {/* Right column: Live POS Preview */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                POS Tile Live Preview
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                Interactive
              </span>
            </div>

            {/* Simulated POS Card */}
            <div className={`p-4 rounded-2xl border transition-all ${
              formIsAvailable
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-rose-50/50 border-rose-200 opacity-80'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <FoodTypeDot foodType={formFoodType} className="size-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm text-slate-900 truncate">
                    {formName || 'Your Dish Name'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {selectedCategoryObj?.name || 'Category'}
                  </p>
                </div>
                {!formIsAvailable && (
                  <span className="rounded-md bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[10px] font-black">
                    86'd (Out of Stock)
                  </span>
                )}
              </div>

              {formDescription && (
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-2">
                  {formDescription}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasHalf && formHalfPrice && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                      Half: {money(formHalfPrice)}
                    </span>
                  )}
                  <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                    Full: {formFullPrice ? money(formFullPrice) : '₹—'}
                  </span>
                </div>
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  + ADD
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              This is how your cashier and order punch screen will render this item on the live billing terminal.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
