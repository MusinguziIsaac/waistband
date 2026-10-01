import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './components/Layout/Layout'

// Pages
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import Dashboard from './pages/Dashboard/Dashboard'
import DailySales from './pages/DailySales/DailySales'
import Hostels from './pages/Hostels/Hostels'
import Distribution from './pages/Distribution/Distribution'
import DirectSales from './pages/DirectSales/DirectSales'
import AgentSales from './pages/AgentSales/AgentSales'
import Agents from './pages/Agents/Agents'
import SalesHistory from './pages/SalesHistory/SalesHistory'
import Reports from './pages/Reports/Reports'
import Notifications from './pages/Notifications/Notifications'
import Profile from './pages/Profile/Profile'

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/" replace /> : <Register />}
      />

      {/* Protected — all wrapped in Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-sales"
        element={
          <ProtectedRoute>
            <Layout>
              <DailySales />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hostels"
        element={
          <ProtectedRoute>
            <Layout>
              <Hostels />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/distribution"
        element={
          <ProtectedRoute>
            <Layout>
              <Distribution />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/direct-sales"
        element={
          <ProtectedRoute>
            <Layout>
              <DirectSales />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent-sales"
        element={
          <ProtectedRoute>
            <Layout>
              <AgentSales />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agents"
        element={
          <ProtectedRoute>
            <Layout>
              <Agents />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Layout>
              <SalesHistory />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Layout>
              <Notifications />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
