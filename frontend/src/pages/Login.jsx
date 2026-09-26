import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { errorMessage } from '@/services/api'
import { landingPath } from '@/utils/roles'
import { PageLoader } from '@/components/ui/Misc'

export default function Login() {
  const { login, status, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { username: '', password: '' } })

  useEffect(() => {
    if (params.get('expired')) setFormError('Session expired. Please log in again.')
  }, [params])

  useEffect(() => {
    if (status === 'guest') setFocus('username')
  }, [status, setFocus])

  if (status === 'loading') return <PageLoader label="Verifying session…" />
  if (status === 'authed') {
    return <Navigate to={location.state?.from || landingPath(role)} replace />
  }

  const onSubmit = async ({ username, password }) => {
    setFormError('')
    try {
      const user = await login(username.trim(), password)
      navigate(location.state?.from || landingPath(user.role), { replace: true })
    } catch (error) {
      setFormError(
        error?.response?.status === 401
          ? 'Invalid username or password.'
          : errorMessage(error, 'Login failed. Is the server running?'),
      )
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] relative flex flex-col justify-between selection:bg-rose-100 selection:text-rose-700">
      {/* BEGIN: AmbientBackgroundDecor */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] h-[380px] bg-gradient-to-b from-rose-200/50 via-pink-100/30 to-transparent blur-3xl opacity-75 pointer-events-none" />
      </div>
      {/* END: AmbientBackgroundDecor */}

      <header className="relative z-20 w-full pt-4 pb-0 flex justify-center px-4" />

      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[430px]">
          {/* BEGIN: BrandHeader */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 relative group cursor-pointer transition-transform duration-300 hover:scale-110">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 p-[1.5px] shadow-lg shadow-rose-500/20 flex items-center justify-center">
                <span className="text-2xl" role="img" aria-label="Restaurant">
                  🍽️
                </span>
              </div>
              <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border-2 border-white" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1.5 flex items-center justify-center gap-1 transition-transform duration-200">
              <span>Re</span>
              <span className="text-rose-600">Bill</span>
            </h1>
            <p className="text-[13px] sm:text-sm text-slate-500 font-medium tracking-normal">
              Restaurant Billing &amp; WhatsApp Engagement
            </p>
          </div>
          {/* END: BrandHeader */}

          {/* BEGIN: LoginFormCard */}
          <div className="bg-white rounded-3xl p-7 sm:p-9 shadow-subtle-card border border-slate-200/80 backdrop-blur-sm relative card-ambient-hover">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Username Input Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700" htmlFor="username">
                    Username <span className="text-rose-600 font-bold">*</span>
                  </label>
                </div>
                <div className="relative rounded-xl shadow-xs group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-rose-600 transition-all duration-200">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter username"
                    disabled={isSubmitting}
                    className="field-input block w-full rounded-xl border border-slate-200 bg-[#F8FAFD] pl-10 pr-3.5 py-3 text-sm font-medium text-slate-900 transition-all duration-200 placeholder:text-slate-400 hover:bg-[#F1F5F9]/60 focus:bg-white focus:outline-none"
                    {...register('username', { required: 'Username is required' })}
                  />
                </div>
                {errors.username && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.username.message}</p>
                )}
              </div>

              {/* Password Input Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700" htmlFor="password">
                    Password <span className="text-rose-600 font-bold">*</span>
                  </label>
                </div>
                <div className="relative rounded-xl shadow-xs group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-rose-600 transition-all duration-200">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="field-input block w-full rounded-xl border border-slate-200 bg-[#F8FAFD] pl-10 pr-11 py-3 text-sm font-medium text-slate-900 transition-all duration-200 placeholder:text-slate-400 hover:bg-[#F1F5F9]/60 focus:bg-white focus:outline-none tracking-wider"
                    {...register('password', { required: 'Password is required' })}
                  />
                  {/* Password Visibility Toggle Button */}
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.password.message}</p>
                )}
              </div>

              {/* Form Error Message */}
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-xs font-bold text-rose-700 flex items-center gap-2"
                >
                  <span className="text-sm">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Action Button with Halo and Sheen */}
              <div className="pt-2 relative">
                {/* Radiating ambient glow behind button */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-rose-600/30 via-rose-500/20 to-rose-700/30 blur-md pointer-events-none btn-halo" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide text-white bg-gradient-to-r from-rose-600 via-rose-600 to-[#cf1340] hover:from-rose-500 hover:to-rose-700 shadow-btn-crimson login-btn-animated flex items-center justify-center gap-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 overflow-hidden shimmer-effect disabled:opacity-60 disabled:cursor-wait"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-85" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="tracking-wide font-semibold">Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="btn-text inline-block transition-transform duration-200">Login</span>
                      <svg className="btn-icon w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          {/* END: LoginFormCard */}

          {/* BEGIN: BottomSupportNote */}
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 border border-slate-200/60 shadow-xs text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ReBill Cloud POS • Operational</span>
            </div>
          </div>
          {/* END: BottomSupportNote */}
        </div>
      </main>
    </div>
  )
}
