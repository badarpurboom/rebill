import { useState } from 'react'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'

/**
 * Discount above the owner-set ceiling needs an owner at the till.
 */
export default function OwnerAuthModal({ discountPercent, maxPercent, error, onCancel, onConfirm }) {
  const [username, setUsername] = useState('owner')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await onConfirm(username.trim(), password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onCancel}
      title="Owner Authorization Required"
      subtitle={`${discountPercent}% discount exceeds maximum allowed limit (${maxPercent}%)`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button form="owner-auth" type="submit" loading={busy} disabled={!password}>
            Approve & Generate Bill
          </Button>
        </>
      }
    >
      <form id="owner-auth" onSubmit={submit} className="space-y-4">
        <FormRow label="Owner Username" htmlFor="owner_username">
          <Input
            id="owner_username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Owner Password" htmlFor="owner_password">
          <Input
            id="owner_password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="off"
          />
        </FormRow>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <p className="text-xs text-slate-500">
          The approving Owner username will be recorded on the bill.
        </p>
      </form>
    </Modal>
  )
}
