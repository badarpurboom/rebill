const VARIANT = {
  primary: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white font-black shadow-md shadow-rose-600/20 hover:from-rose-700 hover:to-rose-800 focus-visible:outline-rose-600',
  secondary: 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 font-bold shadow-2xs',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 font-bold focus-visible:outline-rose-600',
  ghost: 'text-slate-600 hover:bg-slate-100 font-semibold',
}

const SIZE = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 active:scale-95
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
