import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/services/api'
import { tables as tableApi } from '@/services/tables'
import Button from '@/components/ui/Button'
import { FormRow, Input, Select } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'

export default function TableFormModal({ table, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(table?.id)
  const [formError, setFormError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      number: table?.number ?? '',
      label: table?.label ?? '',
      seats: table?.seats ?? 4,
      shape: table?.shape ?? 'SQUARE',
      is_active: table?.is_active ?? true,
    },
  })

  const onSubmit = async (values) => {
    setFormError('')
    const payload = {
      number: String(values.number).trim(),
      label: values.label.trim(),
      seats: Number(values.seats),
      shape: values.shape,
      is_active: Boolean(values.is_active),
    }
    try {
      const saved = isEdit
        ? await tableApi.update(table.id, payload)
        : await tableApi.create(payload)
      onSaved(saved, !isEdit)
    } catch (error) {
      setFormError(errorMessage(error, 'Failed to save table.'))
    }
  }

  const remove = async () => {
    if (!window.confirm(`Table ${table.number} hata dein?`)) return
    setDeleting(true)
    setFormError('')
    try {
      await tableApi.remove(table.id)
      onDeleted(table)
    } catch (error) {
      setFormError(errorMessage(error, 'Failed to delete table.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isEdit ? `Table ${table.number}` : 'Naya table'}
      footer={
        <>
          {isEdit && (
            <Button variant="danger" onClick={remove} loading={deleting} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="table-form" type="submit" loading={isSubmitting}>
            {isEdit ? 'Update' : 'Add'}
          </Button>
        </>
      }
    >
      <form id="table-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Table number" required htmlFor="number" error={errors.number?.message}>
            <Input
              id="number"
              autoFocus
              placeholder="12"
              error={errors.number}
              {...register('number', { required: 'Number is required' })}
            />
          </FormRow>

          <FormRow label="Seats" required htmlFor="seats" error={errors.seats?.message}>
            <Input
              id="seats"
              type="number"
              min="1"
              max="30"
              error={errors.seats}
              {...register('seats', {
                required: 'Seats is required',
                min: { value: 1, message: 'Kam se kam 1' },
              })}
            />
          </FormRow>
        </div>

        <FormRow label="Label (optional)" htmlFor="label">
          <Input id="label" placeholder="Garden Side" {...register('label')} />
        </FormRow>

        <FormRow label="Shape" htmlFor="shape">
          <Select id="shape" {...register('shape')}>
            <option value="SQUARE">Square</option>
            <option value="ROUND">Round</option>
            <option value="RECT">Rectangle</option>
          </Select>
        </FormRow>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="accent-brand-600 size-4 rounded" {...register('is_active')} />
          Table chalu hai (uncheck = temporarily band)
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
