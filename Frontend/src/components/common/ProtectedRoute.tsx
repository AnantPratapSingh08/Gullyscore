// src/components/common/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Wraps protected routes.
 * - While Firebase is resolving auth state → show full-screen spinner
 * - No user → redirect to /login
 * - User not email-verified → redirect to /verify-email
 * - Authenticated & verified → render the child route via <Outlet />
 */
export function ProtectedRoute() {
  const { user, loading, emailVerified } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading GullyScore…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  return <Outlet />
}

export default ProtectedRoute
