import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDateTime } from '../../utils/formatting'
import {
  Bell,
  CheckCheck,
  Check,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Package,
  DollarSign,
  Share2,
  Building2,
  FileText,
  Trash2,
  RotateCcw,
  Search,
  ExternalLink,
  Filter,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react'

const typeIcon = (type, category) => {
  if (category === 'stock') return <Package size={18} className="text-amber-600" />
  if (category === 'sales') return <DollarSign size={18} className="text-emerald-600" />
  if (category === 'agents') return <Share2 size={18} className="text-primary-600" />
  if (category === 'hostels') return <Building2 size={18} className="text-teal-600" />
  if (category === 'reports') return <FileText size={18} className="text-blue-600" />

  switch (type) {
    case 'success': return <CheckCircle size={18} className="text-emerald-600" />
    case 'warning': return <AlertTriangle size={18} className="text-amber-500" />
    case 'error':   return <XCircle size={18} className="text-danger" />
    default:        return <Info size={18} className="text-blue-500" />
  }
}

const categoryBadge = (category) => {
  switch (category) {
    case 'stock':
      return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Stock</span>
    case 'sales':
      return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Sales &amp; Cash</span>
    case 'agents':
      return <span className="bg-primary-100 text-primary-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Agents</span>
    case 'hostels':
      return <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Hostels</span>
    case 'reports':
      return <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Reports</span>
    default:
      return <span className="bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-full">System</span>
  }
}

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    refresh
  } = useNotifications()

  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'unread' | 'stock' | 'sales' | 'agents' | 'reports'
  const [searchQuery, setSearchQuery] = useState('')

  const readCount = notifications.filter(n => n.is_read).length

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Category / Read Filter
      if (activeFilter === 'unread' && n.is_read) return false
      if (activeFilter === 'stock' && n.category !== 'stock') return false
      if (activeFilter === 'sales' && n.category !== 'sales') return false
      if (activeFilter === 'agents' && n.category !== 'agents' && n.category !== 'hostels') return false
      if (activeFilter === 'reports' && n.category !== 'reports' && n.category !== 'system') return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = n.title?.toLowerCase().includes(q)
        const msgMatch = n.message?.toLowerCase().includes(q)
        return titleMatch || msgMatch
      }

      return true
    })
  }, [notifications, activeFilter, searchQuery])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <div className="p-2 bg-primary-100 text-primary-700 rounded-xl">
              <Bell size={24} />
            </div>
            <span>Notifications &amp; Activity Center</span>
          </h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `You have ${unreadCount} unread update${unreadCount !== 1 ? 's' : ''} requiring your attention`
              : 'All caught up! No unread notifications'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn-secondary btn-sm flex items-center gap-1.5 shadow-sm"
              title="Mark all notifications as read"
            >
              <CheckCheck size={16} className="text-primary-600" />
              <span>Mark all as read</span>
            </button>
          )}

          {readCount > 0 && (
            <button
              onClick={clearAllRead}
              className="btn-ghost btn-sm text-text-secondary hover:text-danger hover:bg-red-50 flex items-center gap-1.5"
              title="Clear all read notifications"
            >
              <Trash2 size={15} />
              <span>Clear read ({readCount})</span>
            </button>
          )}

          <button
            onClick={refresh}
            className="btn-ghost btn-sm p-2 text-text-secondary hover:text-primary"
            title="Refresh notifications"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card">
        <div className="card-body py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveFilter('all')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <span>All</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'all' ? 'bg-white/20' : 'bg-white text-text-primary font-bold'}`}>
                  {notifications.length}
                </span>
              </button>

              <button
                onClick={() => setActiveFilter('unread')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'unread'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeFilter === 'unread' ? 'bg-white text-primary' : 'bg-danger text-white'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveFilter('stock')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'stock'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <Package size={13} />
                <span>Stock &amp; Inventory</span>
              </button>

              <button
                onClick={() => setActiveFilter('sales')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'sales'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <DollarSign size={13} />
                <span>Sales &amp; Cash</span>
              </button>

              <button
                onClick={() => setActiveFilter('agents')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'agents'
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <Share2 size={13} />
                <span>Agents &amp; Hostels</span>
              </button>

              <button
                onClick={() => setActiveFilter('reports')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === 'reports'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-muted text-text-secondary hover:bg-gray-200'
                }`}
              >
                <FileText size={13} />
                <span>Reports</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] md:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Search updates..."
                className="form-input text-xs pl-9 py-1.5 h-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 skeleton h-24" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
            <Bell size={28} />
          </div>
          <h3 className="text-text-primary font-bold text-base">No notifications found</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No updates matching "${searchQuery}". Try clearing your search.`
              : activeFilter === 'unread'
              ? 'You have read all notifications. Nice work!'
              : 'You have no notifications in this category.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="btn-secondary btn-sm mt-4 mx-auto"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(n => (
            <div
              key={n.id}
              className={`rounded-xl border transition-all duration-150 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                !n.is_read
                  ? 'bg-white border-primary-200 shadow-sm ring-1 ring-primary-100'
                  : 'bg-white/80 border-border opacity-85 hover:opacity-100 hover:bg-white'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  n.category === 'stock' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                  n.category === 'sales' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                  n.category === 'agents' ? 'bg-primary-50 text-primary-700 border border-primary-200/60' :
                  n.category === 'hostels' ? 'bg-teal-50 text-teal-700 border border-teal-200/60' :
                  'bg-blue-50 text-blue-700 border border-blue-200/60'
                }`}>
                  {typeIcon(n.type, n.category)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryBadge(n.category)}
                    {!n.is_read && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-pulse" />
                        Unread
                      </span>
                    )}
                    <span className="text-xs text-text-secondary">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>

                  <h3 className={`text-sm sm:text-base ${!n.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                    {n.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    {n.message}
                  </p>

                  {/* Optional Action Deep-Link Button */}
                  {n.action_url && (
                    <div className="pt-2">
                      <Link
                        to={n.action_url}
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span>{n.action_label || 'Go to Page'}</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons (Mark read/unread, Delete) */}
              <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                <button
                  onClick={() => n.is_read ? markAsUnread(n.id) : markAsRead(n.id)}
                  className={`btn-ghost btn-sm text-xs p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                    n.is_read ? 'text-text-secondary hover:text-text-primary' : 'text-primary hover:bg-primary-50'
                  }`}
                  title={n.is_read ? 'Mark as unread' : 'Mark as read'}
                >
                  {n.is_read ? <EyeOff size={15} /> : <Eye size={15} />}
                  <span className="hidden md:inline text-[11px] font-semibold">
                    {n.is_read ? 'Unread' : 'Read'}
                  </span>
                </button>

                <button
                  onClick={() => deleteNotification(n.id)}
                  className="btn-ghost btn-sm p-1.5 text-text-secondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete notification"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
