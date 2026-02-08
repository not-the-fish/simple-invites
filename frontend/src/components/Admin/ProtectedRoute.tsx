import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      setAuthToken(token)
      // Verify token is still valid
      adminApi
        .getMe()
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          localStorage.removeItem('admin_token')
          setAuthToken(null)
          setIsAuthenticated(false)
        })
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/admin/login" replace />
}


