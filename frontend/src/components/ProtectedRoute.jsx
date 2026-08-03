import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { landingPath } from '@/utils/roles'
import { PageLoader } from '@/components/ui/Misc'

/**
 * Guards a route subtree. `allow` limits it to specific roles; omit it to mean
 * "any signed-in staff member". Server-side permissions are the real security
 * boundary — this just keeps the UI honest.
 */
export default function ProtectedRoute({ allow }) {
  const { status, role } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Verifying session…" />

  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={landingPath(role)} replace />
  }

  return <Outlet />
}
