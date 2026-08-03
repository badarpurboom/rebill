const base =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 focus:outline-none ' +
  'disabled:bg-slate-50 disabled:text-slate-400 transition-colors shadow-2xs'

export function Label({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-extrabold text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  )
}

export function Input({ error, className = '', ...props }) {
  return (
    <input
      className={`${base} ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`}
      {...props}
    />
  )
}

export function Select({ error, className = '', children, ...props }) {
  return (
    <select
      className={`${base} ${error ? 'border-rose-400' : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-rose-600 font-semibold">{children}</p>
}

export function FormRow({ label, required, error, htmlFor, children }) {
  return (
    <div>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
