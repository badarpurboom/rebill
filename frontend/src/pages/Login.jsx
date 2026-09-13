import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { errorMessage } from '@/services/api'
import { landingPath } from '@/utils/roles'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Misc'

export default function Login() {
  const { login, status, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
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
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-5xl" aria-hidden>
            🍽️
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">ReBill</h1>
          <p className="mt-1 text-sm text-slate-500">Restaurant Billing &amp; WhatsApp Engagement</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <FormRow label="Username" required htmlFor="username" error={errors.username?.message}>
            <Input
              id="username"
              autoComplete="username"
              placeholder="Enter username"
              error={errors.username}
              {...register('username', { required: 'Enter username' })}
            />
          </FormRow>

          <FormRow label="Password" required htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password}
              {...register('password', { required: 'Enter password' })}
            />
          </FormRow>

          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Login
          </Button>
        </form>
      </div>
    </div>
  )
}
