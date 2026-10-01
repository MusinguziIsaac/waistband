import { useState } from 'react'
import { authService } from '../../services/authService'
import Modal from '../../components/Modal/Modal'
import { Lock, Mail, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Password reset modal state
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authService.signIn(email, password)
      // Navigation is automatically handled by AppRoutes / ProtectedRoute when session updates
    } catch (e) {
      setError(e.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    setResetMessage('')
    try {
      await authService.resetPassword(resetEmail)
      setResetMessage('Password reset email sent! Check your inbox for instructions.')
    } catch (err) {
      setResetError(err.message || 'Failed to send reset link.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="WAISTBAND HUB LTD Logo" className="h-36 w-36 mx-auto mb-3 object-contain filter drop-shadow-[0_4px_20px_rgba(34,197,94,0.45)]" />
          <h1 className="text-2xl font-black text-text-primary tracking-wide">WAISTBAND HUB LTD</h1>
          <p className="text-text-secondary mt-1 text-sm font-medium">Voucher Sales &amp; Reporting System</p>
        </div>

        <div className="card">
          <div className="card-body p-8">
            <h2 className="text-lg font-bold text-text-primary mb-6 text-center">Sign In</h2>
            
            {error && (
              <div className="alert-danger mb-6">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="form-label">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type="email"
                    className="form-input pl-10"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email)
                      setResetError('')
                      setResetMessage('')
                      setResetModalOpen(true)
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full justify-center btn-lg"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-text-secondary">
              Don't have an account?{' '}
              <a href="/register" className="font-semibold text-primary hover:underline">
                Register here
              </a>
            </div>
          </div>
        </div>
        
        <p className="text-center text-sm text-text-secondary mt-8">
          &copy; {new Date().getFullYear()} Waistband Hub Ltd. All rights reserved.
        </p>
      </div>

      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Reset Password">
        <form onSubmit={handleResetPassword}>
          <div className="modal-body space-y-4">
            <p className="text-sm text-text-secondary">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {resetError && (
              <div className="alert-danger">
                <AlertCircle size={16} className="shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetMessage && (
              <div className="alert-success">
                <CheckCircle size={16} className="shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="marketer@waistband.co.ug"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetLoading}
              className="btn-primary"
            >
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
