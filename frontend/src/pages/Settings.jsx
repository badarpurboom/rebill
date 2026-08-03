import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { restaurantSettings } from '@/services/billing'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Misc'

export default function Settings() {
  const toast = useToast()
  const [config, setConfig] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm()

  useEffect(() => {
    restaurantSettings
      .get()
      .then((data) => {
        setConfig(data)
        reset(data)
      })
      .catch((error) => toast.error(errorMessage(error, 'Failed to load settings.')))
  }, [reset, toast])

  const prefix = watch('bill_prefix')
  const padding = watch('bill_number_padding')
  const cgst = watch('cgst_percent')
  const sgst = watch('sgst_percent')
  const loyaltyOn = watch('loyalty_enabled')
  const earnAmount = watch('loyalty_earn_amount')
  const earnPoints = watch('loyalty_earn_points')
  const redeemValue = watch('loyalty_redeem_value')

  const onSubmit = async (values) => {
    try {
      const saved = await restaurantSettings.update({
        restaurant_name: values.restaurant_name.trim(),
        address: values.address.trim(),
        gstin: values.gstin.trim(),
        phone: values.phone.trim(),
        bill_prefix: values.bill_prefix.trim().toUpperCase(),
        bill_number_padding: Number(values.bill_number_padding),
        cgst_percent: values.cgst_percent,
        sgst_percent: values.sgst_percent,
        max_discount_percent: values.max_discount_percent,
        loyalty_enabled: Boolean(values.loyalty_enabled),
        loyalty_earn_amount: values.loyalty_earn_amount,
        loyalty_earn_points: Number(values.loyalty_earn_points),
        loyalty_redeem_value: values.loyalty_redeem_value,
        loyalty_min_redeem_points: Number(values.loyalty_min_redeem_points),
        loyalty_max_redeem_percent: values.loyalty_max_redeem_percent,
      })
      setConfig(saved)
      reset(saved)
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save settings.'))
    }
  }

  if (!config) return <PageLoader label="Loading restaurant configuration…" />

  const previewNumber = `${(prefix || 'RB').toUpperCase()}-${String(config.next_bill_number).padStart(Number(padding) || 4, '0')}`
  const totalGst = (Number(cgst || 0) + Number(sgst || 0)).toFixed(2)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Restaurant Settings</h1>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Bill header, GST rates, cashier discount limit &amp; loyalty rules
          </p>
        </div>

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isDirty}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20 disabled:opacity-50"
        >
          {isDirty ? 'Save All Changes' : 'All Settings Saved'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Bill Header Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold tracking-wider text-slate-400 uppercase">Bill Header &amp; Receipt Profile</h2>

          <div className="space-y-4">
            <FormRow
              label="Restaurant Name"
              required
              htmlFor="restaurant_name"
              error={errors.restaurant_name?.message}
            >
              <Input
                id="restaurant_name"
                className="rounded-2xl py-2.5 font-bold"
                error={errors.restaurant_name}
                {...register('restaurant_name', { required: 'Please enter restaurant name' })}
              />
            </FormRow>

            <FormRow label="Address" htmlFor="address">
              <textarea
                id="address"
                rows={2}
                className="focus:border-rose-500 focus:ring-rose-200 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2"
                {...register('address')}
              />
            </FormRow>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="GSTIN" htmlFor="gstin" error={errors.gstin?.message}>
                <Input
                  id="gstin"
                  placeholder="07AABCU9603R1ZM"
                  maxLength={15}
                  className="uppercase font-mono rounded-2xl"
                  error={errors.gstin}
                  {...register('gstin', {
                    validate: (v) =>
                      !v || v.trim().length === 15 || 'GSTIN must be 15 characters',
                  })}
                />
              </FormRow>

              <FormRow label="Phone" htmlFor="phone">
                <Input id="phone" placeholder="9876543210" className="rounded-2xl" {...register('phone')} />
              </FormRow>
            </div>
          </div>
        </div>

        {/* Bill Numbering Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold tracking-wider text-slate-400 uppercase">Bill Numbering &amp; Sequential Format</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="Bill Prefix" required htmlFor="bill_prefix" error={errors.bill_prefix?.message}>
              <Input
                id="bill_prefix"
                maxLength={8}
                className="uppercase font-bold rounded-2xl"
                error={errors.bill_prefix}
                {...register('bill_prefix', { required: 'Please enter bill prefix' })}
              />
            </FormRow>

            <FormRow label="Padding Digits" htmlFor="bill_number_padding">
              <Input
                id="bill_number_padding"
                type="number"
                min="1"
                max="8"
                className="rounded-2xl"
                {...register('bill_number_padding')}
              />
            </FormRow>

            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">Next Generated Bill #</p>
              <p className="tabular rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-800">
                {previewNumber}
              </p>
            </div>
          </div>
        </div>

        {/* GST Rates & Discount Limit Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold tracking-wider text-slate-400 uppercase">GST Tax Rates &amp; Cashier Discount Limit</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="CGST %" htmlFor="cgst_percent">
              <Input id="cgst_percent" type="number" step="0.01" min="0" className="rounded-2xl" {...register('cgst_percent')} />
            </FormRow>

            <FormRow label="SGST %" htmlFor="sgst_percent">
              <Input id="sgst_percent" type="number" step="0.01" min="0" className="rounded-2xl" {...register('sgst_percent')} />
            </FormRow>

            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">Combined Total GST</p>
              <p className="tabular rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-900">
                {totalGst}% Rate
              </p>
            </div>
          </div>

          <div className="mt-4 max-w-sm">
            <FormRow
              label="Max Cashier Discount % Limit"
              htmlFor="max_discount_percent"
              error={errors.max_discount_percent?.message}
            >
              <Input
                id="max_discount_percent"
                type="number"
                step="0.5"
                min="0"
                max="100"
                className="rounded-2xl font-bold"
                error={errors.max_discount_percent}
                {...register('max_discount_percent', {
                  min: { value: 0, message: 'Must be at least 0' },
                  max: { value: 100, message: 'Cannot exceed 100' },
                })}
              />
            </FormRow>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              Discounts above this percentage prompt for Owner password authorization.
            </p>
          </div>
        </div>

        {/* Loyalty Program Settings Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-wider text-slate-400 uppercase">Loyalty Points Engine</h2>
            <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
              <input
                type="checkbox"
                className="accent-rose-600 size-4 rounded"
                {...register('loyalty_enabled')}
              />
              Enable Loyalty System
            </label>
          </div>

          <fieldset disabled={!loyaltyOn} className="space-y-4 disabled:opacity-40">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-900">Points Earning Rule</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Bill Spend Amount (₹)" htmlFor="loyalty_earn_amount">
                  <Input
                    id="loyalty_earn_amount"
                    type="number"
                    step="1"
                    min="1"
                    className="rounded-xl"
                    {...register('loyalty_earn_amount')}
                  />
                </FormRow>
                <FormRow label="Points Earned" htmlFor="loyalty_earn_points">
                  <Input
                    id="loyalty_earn_points"
                    type="number"
                    step="1"
                    min="1"
                    className="rounded-xl"
                    {...register('loyalty_earn_points')}
                  />
                </FormRow>
              </div>
              <p className="text-[11px] font-bold text-rose-700">
                Rule: Customer spends ₹{Number(earnAmount || 0).toFixed(0)} → Earns +{earnPoints || 0} Loyalty Point(s).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-900">Points Redemption Rule</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormRow label="Value (1 pt = ₹)" htmlFor="loyalty_redeem_value">
                  <Input
                    id="loyalty_redeem_value"
                    type="number"
                    step="0.25"
                    min="0"
                    className="rounded-xl"
                    {...register('loyalty_redeem_value')}
                  />
                </FormRow>
                <FormRow label="Min Points to Redeem" htmlFor="loyalty_min_redeem_points">
                  <Input
                    id="loyalty_min_redeem_points"
                    type="number"
                    step="1"
                    min="0"
                    className="rounded-xl"
                    {...register('loyalty_min_redeem_points')}
                  />
                </FormRow>
                <FormRow label="Max Bill % Cap" htmlFor="loyalty_max_redeem_percent">
                  <Input
                    id="loyalty_max_redeem_percent"
                    type="number"
                    step="5"
                    min="0"
                    max="100"
                    className="rounded-xl"
                    {...register('loyalty_max_redeem_percent')}
                  />
                </FormRow>
              </div>
              <p className="text-[11px] font-bold text-slate-500">
                100 points = ₹{(100 * Number(redeemValue || 0)).toFixed(0)}. Max bill cap ensures GST tax is collected safely.
              </p>
            </div>
          </fieldset>
        </div>
      </div>
    </form>
  )
}
