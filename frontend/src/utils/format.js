const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

/** ₹1,234.00 — the only currency ReBill deals in. */
export function money(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? inr.format(amount) : inr.format(0)
}

/** Compact form for dense grids: ₹240 (paise dropped when they're .00) */
export function priceShort(value) {
  const amount = Number(value ?? 0)
  return `₹${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`
}

export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
