import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/services/api'
import { customers as customerApi } from '@/services/customers'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'

export default function CustomerFormModal({ customer, prefillPhone = '', onClose, onSaved }) {
  const isEdit = Boolean(customer?.id)
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? prefillPhone,
      dob: customer?.dob ?? '',
      anniversary: customer?.anniversary ?? '',
      note: customer?.note ?? '',
    },
  })

  const onSubmit = async (values) => {
    setFormError('')
    const payload = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      // Blank date inputs must go as null, not '' — DRF rejects empty strings.
      dob: values.dob || null,
      anniversary: values.anniversary || null,
      note: values.note.trim(),
    }
    try {
      const saved = isEdit
        ? await customerApi.update(customer.id, payload)
        : await customerApi.create(payload)
      onSaved(saved, !isEdit)
    } catch (error) {
      setFormError(errorMessage(error, 'Failed to save customer.'))
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={isEdit ? 'Edit Customer' : 'New Customer'}
      subtitle={isEdit ? customer.phone : 'Phone number is the primary identifier'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="customer-form" type="submit" loading={isSubmitting}>
            {isEdit ? 'Update Customer' : 'Register Customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormRow label="Name" required htmlFor="cname" error={errors.name?.message}>
          <Input
            id="cname"
            autoFocus
            placeholder="Ankit Gupta"
            error={errors.name}
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Minimum 2 characters' },
            })}
          />
        </FormRow>

        <FormRow label="Mobile Number" required htmlFor="cphone" error={errors.phone?.message}>
          <Input
            id="cphone"
            inputMode="tel"
            placeholder="9876543210"
            error={errors.phone}
            {...register('phone', { required: 'Phone number is required' })}
          />
        </FormRow>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Birthday (optional)" htmlFor="dob">
            <Input id="dob" type="date" {...register('dob')} />
          </FormRow>
          <FormRow label="Anniversary (optional)" htmlFor="anniversary">
            <Input id="anniversary" type="date" {...register('anniversary')} />
          </FormRow>
        </div>

        <FormRow label="Note (optional)" htmlFor="note">
          <Input id="note" placeholder="Prefers window seat" {...register('note')} />
        </FormRow>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Birthday and anniversary are optional — when provided, automated WhatsApp greetings will be sent automatically.
        </p>

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
