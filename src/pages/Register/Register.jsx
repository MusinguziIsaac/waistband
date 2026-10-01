import { useState } from 'react'
import { Link, useNavigate } from 'react'
import { authService } from '../../services/authService'
import { User, Mail, Phone, MapPin, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const data = await authService.signUp(email, password, { fullName, phone, region })
      if (data?.session) {
        setSuccess('Registration successful! Logging you in...')
      } else {
        setSuccess('Account created! Please check your email for a verification link to confirm your account.')
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="WAISTBAND HUB LTD Logo" className="h-32 w-32 mx-auto mb-2 object-contain filter drop-shadow-[0_4px_20px_rgba(34,197,94,0.45)]" />
          <h1 className="text-2xl font-black text-text-primary tracking-wide">WAISTBAND HUB LTD</h1>
          <p className="text-text-secondary text-sm mt-1 font-medium">Create a new marketer account</p>
        </div>

        <div className="card">
          <div className="card-body p-6 sm:p-8">
            <h2 className="text-lg font-bold text-text-primary mb-5 text-center">Register Account</h2>

            {error && (
              <div className="alert-danger mb-5">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert-success mb-5">
                <CheckCircle size={18} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="form-label">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type="text"
                    className="form-input pl-10"
                    placeholder="e.g. David Musoke"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type="email"
                    className="form-input pl-10"
                    placeholder="marketer@waistband.co.ug"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={18} className="text-text-secondary" />
                    </div>
                    <input
                      type="tel"
                      className="form-input pl-10"
                      placeholder="+256 700 000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Region / Area</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin size={18} className="text-text-secondary" />
                    </div>
                    <input
                      type="text"
                      className="form-input pl-10"
                      placeholder="e.g. Kampala"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="At least 6 characters"
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

              <div>
                <label className="form-label">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-text-secondary" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center btn-lg"
                >
                  {loading ? 'Creating Account...' : 'Register'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-text-secondary">
              Already have an account?{' '}
              <a href="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          &copy; {new Date().getFullYear()} Waistband Hub Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}
