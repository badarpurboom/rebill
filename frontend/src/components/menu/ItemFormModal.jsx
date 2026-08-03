import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/services/api'
import { items as itemApi } from '@/services/menu'
import Button from '@/components/ui/Button'
import { FormRow, Input, Select } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { FoodTypeDot } from '@/components/ui/Misc'

const price = {
  required: 'Price is required',
  min: { value: 0, message: 'Price cannot be less than 0' },
}

export default function ItemFormModal({ item, categories, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const existingHalf = item?.variants.find((v) => v.portion === 'HALF')
  const existingFull = item?.variants.find((v) => v.portion === 'FULL')

  const [hasHalf, setHasHalf] = useState(Boolean(existingHalf))
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: item?.name ?? '',
      category: item?.category ?? categories[0]?.id ?? '',
      food_type: item?.food_type ?? 'VEG',
      description: item?.description ?? '',
      is_available: item?.is_available ?? true,
      half_price: existingHalf?.price ?? '',
      full_price: existingFull?.price ?? '',
    },
  })

  const foodType = watch('food_type')

  const onSubmit = async (values) => {
    setFormError('')
    const variants = [{ portion: 'FULL', price: values.full_price }]
    if (hasHalf) variants.unshift({ portion: 'HALF', price: values.half_price })

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
      onClose={onClose}
      title={isEdit ? 'Edit Item' : 'New Item'}
      subtitle={isEdit ? item.name : 'Half price is optional — Full price is required'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="item-form" type="submit" loading={isSubmitting}>
            {isEdit ? 'Update' : 'Add'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormRow label="Item ka naam" required htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoFocus
            placeholder="Paneer Tikka"
            error={errors.name}
            {...register('name', {
              required: 'Name is required',
              maxLength: { value: 120, message: 'Naam bahut lamba hai' },
            })}
          />
        </FormRow>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Category" required htmlFor="category" error={errors.category?.message}>
            <Select id="category" {...register('category', { required: 'Category chuno' })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Veg / Non-Veg" htmlFor="food_type">
            <div className="flex items-center gap-2">
              <FoodTypeDot foodType={foodType} className="size-5" />
              <Select id="food_type" {...register('food_type')}>
                <option value="VEG">Veg</option>
                <option value="NON_VEG">Non-Veg</option>
              </Select>
            </div>
          </FormRow>
        </div>

        <FormRow label="Description (optional)" htmlFor="description">
          <Input
            id="description"
            placeholder="Tandoor me pakaya hua paneer"
            {...register('description')}
          />
        </FormRow>

        <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1.5 text-sm font-medium text-slate-700">Price (₹)</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Full" required htmlFor="full_price" error={errors.full_price?.message}>
              <Input
                id="full_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="260"
                error={errors.full_price}
                {...register('full_price', price)}
              />
            </FormRow>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasHalf}
                  onChange={(e) => setHasHalf(e.target.checked)}
                  className="accent-brand-600 size-4 rounded"
                />
                Half plate bhi hai
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="150"
                disabled={!hasHalf}
                error={hasHalf ? errors.half_price : null}
                {...register('half_price', hasHalf ? price : {})}
              />
              {hasHalf && errors.half_price && (
                <p className="mt-1 text-xs text-rose-600">{errors.half_price.message}</p>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Half price must be entered separately — the system does not auto-calculate it.
          </p>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="accent-brand-600 size-4 rounded"
            {...register('is_available')}
          />
          Abhi available hai (uncheck = out of stock)
        </label>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}
