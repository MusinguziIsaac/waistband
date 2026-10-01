import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { authService } from '../../services/authService'
import { initials, formatDateTime } from '../../utils/formatting'
import { User, Mail, Phone, Shield, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [profileForm, setProfileForm] = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    try {
      await authService.updateProfile(user.id, {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
      })
      await refreshProfile()
      setProfileSuccess('Profile updated successfully.')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.newPw.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    setPwSaving(true)
    setPwError('')
    try {
      await authService.updatePassword(pwForm.newPw)
      setPwSuccess('Password changed successfully.')
      setPwForm({ current: '', newPw: '', confirm: '' })
      setTimeout(() => setPwSuccess(''), 3000)
    } catch (err) {
      setPwError(err.message || 'Failed to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  const togglePw = (field) => setShowPw(p => ({ ...p, [field]: !p[field] }))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account information and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-body text-center">
              <div className="w-20 h-20 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">{initials(profile?.full_name)}</span>
              </div>
              <h3 className="font-bold text-text-primary text-lg">{profile?.full_name || 'General Marketer'}</h3>
              <p className="text-text-secondary text-sm mt-1">{profile?.email || user?.email}</p>
              <div className="mt-3">
                <span className="badge-success capitalize">{profile?.role || 'Marketer'}</span>
              </div>
              <div className="divider" />
              <div className="space-y-2 text-sm text-left">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail size={14} />
                  <span className="truncate">{user?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Phone size={14} />
                    {profile.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-text-secondary">
                  <Shield size={14} />
                  <span>Member since {new Date(user?.created_at || Date.now()).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <User size={18} className="text-primary" />
                <h3 className="font-semibold">Personal Information</h3>
              </div>
            </div>
            <div className="card-body">
              {profileError && <div className="alert-danger mb-4"><AlertCircle size={16} />{profileError}</div>}
              {profileSuccess && <div className="alert-success mb-4"><CheckCircle size={16} />{profileSuccess}</div>}

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.full_name}
                    onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" value={user?.email || ''} disabled />
                  <p className="text-xs text-text-secondary mt-1">Email cannot be changed here.</p>
                </div>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+256 700 000 000"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={profileSaving} className="btn-primary">
                    {profileSaving ? 'Saving...' : 'Update Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                <h3 className="font-semibold">Change Password</h3>
              </div>
            </div>
            <div className="card-body">
              {pwError && <div className="alert-danger mb-4"><AlertCircle size={16} />{pwError}</div>}
              {pwSuccess && <div className="alert-success mb-4"><CheckCircle size={16} />{pwSuccess}</div>}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {[
                  { field: 'newPw', label: 'New Password', placeholder: 'Min. 8 characters' },
                  { field: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="form-label">{label}</label>
                    <div className="relative">
                      <input
                        type={showPw[field] ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder={placeholder}
                        value={pwForm[field]}
                        onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" onClick={() => togglePw(field)}>
                        {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {field === 'confirm' && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                      <p className="form-error">Passwords do not match.</p>
                    )}
                  </div>
                ))}
                <div className="flex justify-end">
                  <button type="submit" disabled={pwSaving} className="btn-primary">
                    {pwSaving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
