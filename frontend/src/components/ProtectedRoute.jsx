import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { landingPath, hasPermission } from '@/utils/roles'
import { PageLoader } from '@/components/ui/Misc'

/**
 * Guards a route subtree. `allow` limits it to specific roles; omit it to mean
 * "any signed-in staff member". Server-side permissions are the real security
 * boundary — this just keeps the UI honest.
 */
export default function ProtectedRoute({ permission, children }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Verifying session…" />

  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to={landingPath(user)} replace />
  }

  return children || <Outlet />
}
