import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

/** Gate for the back-office: requires an authenticated admin user. */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30">
        <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/bestellungen" replace />
  return <>{children}</>
}
