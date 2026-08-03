/** Green square for Veg, red for Non-Veg — standard Indian menu marker. */
export function FoodTypeDot({ foodType, className = '' }) {
  const veg = foodType === 'VEG'
  const color = veg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'
  const dot = veg ? 'bg-emerald-600' : 'bg-rose-600'
  return (
    <span
      title={veg ? 'Veg' : 'Non-Veg'}
      aria-label={veg ? 'Veg' : 'Non-Veg'}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${color} ${className}`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
    </span>
  )
}

const BADGE_TONE = {
  slate: 'bg-slate-100 text-slate-700 border border-slate-200/60',
  green: 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/60',
  red: 'bg-rose-100/80 text-rose-800 border border-rose-200/60',
  amber: 'bg-amber-100/80 text-amber-800 border border-amber-200/60',
  brand: 'bg-rose-100 text-rose-800 border border-rose-200',
}

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200
          ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

export function Spinner({ className = 'size-6' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-slate-200 border-t-rose-600 ${className}`}
    />
  )
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Spinner className="size-8" />
      <p className="text-sm font-extrabold tracking-wide text-slate-700">{label}</p>
    </div>
  )
}

export function EmptyState({ icon = '📭', title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-xs">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      {hint && <p className="max-w-sm text-xs font-medium text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Card({ title, action, className = '', children }) {
  return (
    <section className={`rounded-3xl border border-slate-200/80 bg-white shadow-xs ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-black text-slate-900 tracking-wide">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  )
}
