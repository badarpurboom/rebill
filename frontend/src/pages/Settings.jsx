import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/services/api'
import { restaurantSettings } from '@/services/billing'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Misc'
import RolesTab from '@/components/settings/RolesTab'

export default function Settings() {
  const toast = useToast()
  const [config, setConfig] = useState(null)
  const [activeTab, setActiveTab] = useState('general')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Restaurant Settings</h1>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Bill header, GST rates, cashier discount limit &amp; loyalty rules
          </p>
        </div>

        {activeTab === 'general' && (
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!isDirty}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20 disabled:opacity-50"
          >
            {isDirty ? 'Save All Changes' : 'All Settings Saved'}
          </Button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 px-2 overflow-x-auto scroll-thin">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors shrink-0 ${activeTab === 'general' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          General Settings
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors shrink-0 ${activeTab === 'roles' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Staff &amp; Roles
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'ai' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          🤖 AI Integration
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === 'general' ? (
          <form id="settings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          </form>
        ) : activeTab === 'roles' ? (
          <RolesTab />
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                🤖 AI Assistant for Your Restaurant
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 max-w-2xl">
                Apne aaj/kal ke sales data ko ek click mein copy karein aur ChatGPT mein paste karke koi bhi sawaal puchein — bilkul free!
              </p>
            </div>

            {/* STEP 1 - Copy Daily Report */}
            <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-black">1</span>
                <p className="text-sm font-black text-emerald-900">📊 Aaj/Kal ka Report Copy Karein (FREE)</p>
              </div>
              <p className="text-xs font-medium text-emerald-700 ml-9">
                Yeh button aapke POS se live data uthayega — Sales, Top Dishes, Payment — aur ek ready-made report banayega jo aap seedha ChatGPT mein paste kar sakte hain.
              </p>
              <div className="ml-9">
                <Button
                  onClick={async () => {
                    try {
                      setIsCopying(true)
                      const res = await fetch('/api/ai/text-report/')
                      const data = await res.json()
                      await navigator.clipboard.writeText(data.report)
                      toast.success('✅ Report copy ho gayi! Ab ChatGPT mein paste karein.')
                    } catch (e) {
                      toast.error('Report copy karne mein error aaya')
                    } finally {
                      setIsCopying(false)
                    }
                  }}
                  loading={isCopying}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 px-6"
                >
                  {isCopying ? 'Data fetch ho raha hai...' : '📋 Copy Today\'s Report for ChatGPT'}
                </Button>
              </div>
            </div>

            {/* STEP 2 - Paste in ChatGPT */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-white text-xs font-black">2</span>
                <p className="text-sm font-black text-slate-700">ChatGPT mein paste karein aur sawaal puchein</p>
              </div>
              <div className="ml-9 bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-mono text-slate-500 italic">Example: "Aaj ki total sale kitni hui? Aur kal se kitna zyada ya kam?"</p>
              </div>
            </div>

            {/* Token section */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Advanced: Direct API Connection Token</p>
              {!config?.ai_connection_token ? (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        setIsGenerating(true)
                        await restaurantSettings.generateAIToken()
                        const updated = await restaurantSettings.get()
                        setConfig(updated)
                        toast.success('AI Token Generated')
                      } catch (e) {
                        toast.error('Failed to generate token')
                      } finally {
                        setIsGenerating(false)
                      }
                    }}
                    loading={isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm"
                  >
                    Generate Secure Token
                  </Button>
                  <p className="text-xs text-slate-400">(ChatGPT Plus Custom GPT ke liye)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <code className="block bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs font-mono pr-20 break-all">{config.ai_connection_token}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(config.ai_connection_token)
                        toast.success('Token copied!')
                      }}
                      className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white rounded-lg px-2 py-1 text-xs font-bold"
                    >Copy</button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure? This will disconnect any active AI connections.')) {
                          try {
                            await restaurantSettings.revokeAIToken()
                            const updated = await restaurantSettings.get()
                            setConfig(updated)
                            toast.success('AI Token Revoked')
                          } catch (e) {
                            toast.error('Failed to revoke token')
                          }
                        }
                      }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:underline"
                    >
                      Revoke Token
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
