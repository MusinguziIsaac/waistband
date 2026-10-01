import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { authService } from '../../services/authService'
import { initials } from '../../utils/formatting'
import {
  LayoutDashboard,
  CalendarDays,
  Share2,
  TrendingUp,
  DollarSign,
  Users,
  History,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Building2
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/daily-sales', label: 'Daily Stock', icon: CalendarDays },
  { path: '/hostels', label: 'Hostels & Rentals', icon: Building2 },
  { path: '/distribution', label: 'Give to Agents', icon: Share2 },
  { path: '/direct-sales', label: 'Direct Sales', icon: TrendingUp },
  { path: '/agent-sales', label: 'Agent Sales', icon: DollarSign },
  { path: '/agents', label: 'Agents List', icon: Users },
  { path: '/history', label: 'Sales History', icon: History },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/notifications', label: 'Notifications', icon: Bell, isNotif: true },
  { path: '/profile', label: 'My Profile', icon: User },
]

export default function Layout({ children }) {
  const { profile } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authService.signOut()
    } catch (e) {
      console.error(e)
    }
  }

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen)
  const closeMobileMenu = () => setMobileMenuOpen(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border">
      {/* Brand */}
      <div className="h-20 flex items-center px-4 gap-3 border-b border-border bg-white">
        <img src="/logo.png" alt="WAISTBAND HUB LTD Logo" className="h-14 w-14 object-contain filter drop-shadow-[0_2px_8px_rgba(34,197,94,0.4)]" />
        <div className="flex flex-col">
          <span className="font-black text-slate-900 tracking-wider text-sm leading-tight">WAISTBAND</span>
          <span className="text-[11px] font-extrabold text-emerald-600 tracking-wider">HUB LTD</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isActive 
                  ? 'bg-primary text-white' 
                  : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
              }`
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <item.icon size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            {item.isNotif && unreadCount > 0 && (
              <span className="bg-danger text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Area */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
            {initials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{profile?.full_name || 'Marketer'}</p>
            <p className="text-xs text-text-secondary truncate capitalize">{profile?.role || 'General Marketer'}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-danger hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed inset-y-0 w-64 z-20">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeMobileMenu} />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-border flex items-center justify-between px-4 z-30 sticky top-0">
          <div className="flex items-center gap-2">
            <button onClick={toggleMobileMenu} className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-gray-100">
              <Menu size={24} />
            </button>
            <img src="/logo.png" alt="WAISTBAND HUB LTD Logo" className="h-12 w-12 object-contain filter drop-shadow-[0_2px_8px_rgba(34,197,94,0.4)]" />
            <span className="font-extrabold text-base text-text-primary">WAISTBAND HUB</span>
          </div>
          <button 
            onClick={() => navigate('/notifications')}
            className="p-2 text-text-secondary hover:text-primary rounded-full hover:bg-primary-50 relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white" />
            )}
          </button>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-border items-center justify-end px-8 z-10 sticky top-0">
          <button 
            onClick={() => navigate('/notifications')}
            className="p-2 text-text-secondary hover:text-primary rounded-full hover:bg-primary-50 relative transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white" />
            )}
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
