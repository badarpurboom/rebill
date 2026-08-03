import { useEffect, useState } from 'react'
import { errorMessage } from '@/services/api'
import { customers as customerApi } from '@/services/customers'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { Badge, Spinner } from '@/components/ui/Misc'

export default function QuickCustomerModal({
  open,
  onClose,
  minRedeemPoints = 50,
  maxRedeemable,
  onSaveAndProceed,
  onSkipAndProceed,
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState(null)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Auto-lookup customer when 10 digits are typed ─────────────────────
  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) {
      setCustomer(null)
      setRedeemPoints(0)
      setError('')
      return
    }

    setSearching(true)
    setError('')
    const timer = setTimeout(() => {
      customerApi
        .lookup(digits)
        .then((res) => {
          let found = null
          if (res.exact) {
            found = res.exact
          } else if (res.matches && res.matches.length > 0) {
            found = res.matches[0]
          }

          if (found) {
            setCustomer(found)
            setName(found.name)
            const balance = found.points_balance || 0
            if (balance >= minRedeemPoints) {
              const cap = (maxRedeemable && maxRedeemable > 0) ? maxRedeemable : balance
              const allowed = Math.min(balance, cap)
              setRedeemPoints(allowed)
            } else {
              setRedeemPoints(0)
            }
          } else {
            setCustomer(null)
            setRedeemPoints(0)
          }
        })
        .catch((err) => {
          setError(errorMessage(err, 'Failed to lookup customer.'))
        })
        .finally(() => setSearching(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [phone, minRedeemPoints, maxRedeemable])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }
    if (!name.trim()) {
      setError('Please enter customer name')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      let finalCustomer = customer
      if (!customer) {
        // Create new customer
        finalCustomer = await customerApi.create({
          name: name.trim(),
          phone: digits,
        })
      } else if (customer.name !== name.trim()) {
        // Update existing customer name if changed
        finalCustomer = await customerApi.update(customer.id, {
          name: name.trim(),
          phone: customer.phone,
        })
      }

      await onSaveAndProceed(finalCustomer, Number(redeemPoints) || 0)
    } catch (err) {
      setError(errorMessage(err, 'Failed to save customer.'))
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    onSkipAndProceed()
  }

  if (!open) return null

  const digits = phone.replace(/\D/g, '')
  const isValidPhone = digits.length === 10
  const balance = customer?.points_balance || 0
  const canRedeem = balance >= minRedeemPoints

  // Fix: If maxRedeemable is 0 because no customer was attached to the order yet, default cap to customer balance!
  const effectiveMaxCap = (maxRedeemable && maxRedeemable > 0) ? maxRedeemable : balance
  const maxPointsAllowed = canRedeem ? Math.min(balance, effectiveMaxCap) : 0

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="📱 Customer Details & Loyalty"
      subtitle="Enter mobile number to attach customer and apply reward points"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="secondary"
            onClick={handleSkip}
            disabled={submitting}
            className="text-slate-600"
          >
            ⏭️ Skip (Bill Without Customer)
          </Button>

          <Button
            form="quick-customer-form"
            type="submit"
            loading={submitting}
            disabled={!isValidPhone || !name.trim() || searching}
          >
            ⚡ Save & Generate Bill →
          </Button>
        </div>
      }
    >
      <form id="quick-customer-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Mobile Number Field */}
        <FormRow label="Mobile Number" required htmlFor="quick-phone" error={error && !isValidPhone ? error : undefined}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-slate-400">
              +91
            </span>
            <Input
              id="quick-phone"
              autoFocus
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                setPhone(val)
              }}
              className="pl-12 font-mono text-base tracking-wider font-semibold"
            />
            {searching && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2">
                <Spinner className="h-4 w-4 text-brand-600" />
              </span>
            )}
          </div>
        </FormRow>

        {/* Customer Status Banner & Points Card */}
        {isValidPhone && !searching && (
          <div>
            {customer ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Existing Customer Found
                  </span>
                  <Badge tone="green" className="font-bold">
                    Registered
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-white/90 p-2.5 border border-emerald-100">
                  <div>
                    <p className="text-xs text-slate-500">Total Points Balance</p>
                    <p className="text-lg font-extrabold text-emerald-700">
                      ⭐ {balance} Points
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total Visits</p>
                    <p className="text-sm font-bold text-slate-800">
                      {customer.visit_count || 1} Visits
                    </p>
                  </div>
                </div>

                {/* Redeem Points Controls in Pop-up */}
                {canRedeem ? (
                  <div className="rounded-lg bg-emerald-100/60 p-2.5 border border-emerald-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 mb-1.5">
                      <span>🏷️ Redeem Points on Bill:</span>
                      <span className="text-emerald-700 font-bold">
                        {redeemPoints > 0 ? `- ₹${redeemPoints} Discount` : 'No Points Used'}
                      </span>
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <Input
                        type="number"
                        min="0"
                        max={maxPointsAllowed}
                        value={redeemPoints}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(maxPointsAllowed, Number(e.target.value) || 0))
                          setRedeemPoints(val)
                        }}
                        className="w-24 text-center font-bold text-emerald-800 bg-white"
                      />

                      <button
                        type="button"
                        onClick={() => setRedeemPoints(maxPointsAllowed)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition ${
                          redeemPoints === maxPointsAllowed
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        All ({maxPointsAllowed} Pts)
                      </button>

                      <button
                        type="button"
                        onClick={() => setRedeemPoints(Math.floor(maxPointsAllowed / 2))}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 transition"
                      >
                        Half ({Math.floor(maxPointsAllowed / 2)} Pts)
                      </button>

                      <button
                        type="button"
                        onClick={() => setRedeemPoints(0)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-900">
                    ℹ️ <strong>Loyalty Threshold:</strong> Customer has <strong>{balance} points</strong>. Minimum <strong>{minRedeemPoints} points</strong> required to redeem on a bill.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                    ✨ New Customer Registration
                  </span>
                  <Badge tone="blue">New</Badge>
                </div>
                <p className="mt-1 text-xs text-blue-700">
                  This bill will earn loyalty points and send WhatsApp bill receipt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Customer Name Field */}
        <FormRow label="Customer Name" required htmlFor="quick-name">
          <Input
            id="quick-name"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>

        {error && isValidPhone && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
