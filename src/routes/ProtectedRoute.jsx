import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Reloader from '../components/Reloader/Reloader'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <Reloader message="Authenticating user session..." fullScreen={true} />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
