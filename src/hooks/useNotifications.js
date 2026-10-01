import { useState, useEffect, useCallback } from 'react'
import { salesService } from '../services/salesService'
import { hostelService } from '../services/hostelService'
import { useAuth } from './useAuth'
import { todayStr, formatUGX, formatNumber } from '../utils/formatting'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      const today = todayStr()
      const deletedIds = JSON.parse(localStorage.getItem(`deleted_notifs_${user.id}`) || '[]')
      const deletedSet = new Set(deletedIds)
      const customNotifs = JSON.parse(localStorage.getItem(`custom_notifs_${user.id}`) || '[]')

      // Fetch live business data for intelligent proactive notifications
      const [stockInfo, directs, dists, hostels] = await Promise.all([
        salesService.getOverallStockStatus(user.id, today).catch(() => null),
        salesService.getDirectSales(user.id, { date: today }).catch(() => []),
        salesService.getDistributions(user.id, { date: today }).catch(() => []),
        hostelService.getHostels(user.id).catch(() => [])
      ])

      const smartList = []

      // 1. Stock & Inventory Notifications
      if (stockInfo) {
        if (stockInfo.totalStockInHand > 0 || stockInfo.totalCarriedForward > 0) {
          const reminderId = `stock-reminder-${today}`
          const isRead = localStorage.getItem(`read_notif_${reminderId}`) === 'true'
          const breakdownStr = (stockInfo.breakdown || [])
            .filter(b => b.available > 0)
            .map(b => `${b.name}: ${b.available}`)
            .join(' • ')

          smartList.push({
            id: reminderId,
            title: `Daily Stock Reminder: ${formatNumber(stockInfo.totalStockInHand)} Vouchers Ready`,
            message: `Available inventory in hand today: ${breakdownStr || 'Stock ready'}. You can distribute to agents or sell directly.`,
            type: 'info',
            category: 'stock',
            action_url: '/daily-sales',
            action_label: 'Manage Daily Stock',
            is_read: isRead,
            created_at: new Date().toISOString()
          })
        }

        // Low stock alerts (< 10 vouchers)
        (stockInfo.breakdown || []).forEach(b => {
          if (b.isLow) {
            const lowId = `low-stock-${b.package_id}-${today}`
            const isLowRead = localStorage.getItem(`read_notif_${lowId}`) === 'true'
            smartList.push({
              id: lowId,
              title: `Low Stock Alert: ${b.name} (${b.available} left)`,
              message: `Only ${b.available} vouchers remaining in stock for ${b.name}. Add extra stock to meet today's sales demand.`,
              type: 'warning',
              category: 'stock',
              action_url: '/daily-sales',
              action_label: 'Add Extra Stock',
              is_read: isLowRead,
              created_at: new Date().toISOString()
            })
          }
        })
      }

      // 2. Sales & Cash Activity Notifications (Today)
      const directList = directs || []
      if (directList.length > 0) {
        const totalSold = directList.reduce((sum, d) => sum + (Number(d.quantity ?? d.quantity_sold ?? 0)), 0)
        const totalCash = directList.reduce((sum, d) => sum + (Number(d.amount_received || 0)), 0)
        const salesId = `sales-summary-${today}`
        const isSalesRead = localStorage.getItem(`read_notif_${salesId}`) === 'true'

        smartList.push({
          id: salesId,
          title: `Direct Sales Active: ${formatNumber(totalSold)} Vouchers Sold`,
          message: `You have completed ${directList.length} direct sale transaction(s) today with total cash collected of ${formatUGX(totalCash)}.`,
          type: 'success',
          category: 'sales',
          action_url: '/direct-sales',
          action_label: 'View Direct Sales',
          is_read: isSalesRead,
          created_at: new Date().toISOString()
        })
      }

      // 3. Agent Distributions Activity Notifications (Today)
      const distList = dists || []
      if (distList.length > 0) {
        const totalGiven = distList.reduce((sum, d) => sum + (Number(d.quantity || 0)), 0)
        const distId = `dist-summary-${today}`
        const isDistRead = localStorage.getItem(`read_notif_${distId}`) === 'true'

        smartList.push({
          id: distId,
          title: `Agent Distributions: ${formatNumber(totalGiven)} Vouchers Issued`,
          message: `${formatNumber(totalGiven)} vouchers have been issued across ${distList.length} agent distribution(s) today.`,
          type: 'info',
          category: 'agents',
          action_url: '/distribution',
          action_label: 'View Distributions',
          is_read: isDistRead,
          created_at: new Date().toISOString()
        })
      }

      // 4. Hostels & Locations
      const hList = hostels || []
      if (hList.length > 0) {
        const totalRes = hList.reduce((sum, h) => sum + (h.residents_count || 0), 0)
        const hostelId = `hostel-info-${today}`
        const isHRead = localStorage.getItem(`read_notif_${hostelId}`) === 'true'

        smartList.push({
          id: hostelId,
          title: `Hostel Network: ${hList.length} Registered Locations`,
          message: `${hList.length} active hostels and rentals configured covering approximately ${formatNumber(totalRes)} residents.`,
          type: 'info',
          category: 'hostels',
          action_url: '/hostels',
          action_label: 'View Hostels',
          is_read: isHRead,
          created_at: new Date().toISOString()
        })
      }

      // 5. Daily Reports & End-of-Day Reminder
      const reportId = `report-reminder-${today}`
      const isReportRead = localStorage.getItem(`read_notif_${reportId}`) === 'true'
      smartList.push({
        id: reportId,
        title: `Daily Reconciliation Ready: ${today}`,
        message: `Generate your daily sales report to review stock balances, direct sales, agent collections, and cash reconciliation.`,
        type: 'info',
        category: 'reports',
        action_url: '/reports',
        action_label: 'Generate Report',
        is_read: isReportRead,
        created_at: new Date().toISOString()
      })

      // Combine smart notifications and custom stored notifications, applying read statuses
      const combined = [...smartList, ...customNotifs]
        .filter(n => !deletedSet.has(n.id))
        .map(n => {
          const isRead = localStorage.getItem(`read_notif_${n.id}`) === 'true' || n.is_read === true
          return { ...n, is_read: isRead }
        })

      setNotifications(combined)
      setUnreadCount(combined.filter(n => !n.is_read).length)
    } catch (e) {
      console.error('Error loading notifications:', e)
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()
    const handleNotifChange = () => fetchNotifications()
    window.addEventListener('notifs_changed', handleNotifChange)
    return () => window.removeEventListener('notifs_changed', handleNotifChange)
  }, [fetchNotifications])

  const markAsRead = (id) => {
    localStorage.setItem(`read_notif_${id}`, 'true')
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    window.dispatchEvent(new Event('notifs_changed'))
  }

  const markAsUnread = (id) => {
    localStorage.removeItem(`read_notif_${id}`)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n))
    setUnreadCount(prev => prev + 1)
    window.dispatchEvent(new Event('notifs_changed'))
  }

  const markAllAsRead = () => {
    notifications.forEach(n => {
      localStorage.setItem(`read_notif_${n.id}`, 'true')
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    window.dispatchEvent(new Event('notifs_changed'))
  }

  const deleteNotification = (id) => {
    if (!user) return
    const deletedIds = JSON.parse(localStorage.getItem(`deleted_notifs_${user.id}`) || '[]')
    if (!deletedIds.includes(id)) {
      deletedIds.push(id)
      localStorage.setItem(`deleted_notifs_${user.id}`, JSON.stringify(deletedIds))
    }

    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id)
      setUnreadCount(next.filter(n => !n.is_read).length)
      return next
    })
    window.dispatchEvent(new Event('notifs_changed'))
  }

  const clearAllRead = () => {
    if (!user) return
    const readList = notifications.filter(n => n.is_read)
    const deletedIds = JSON.parse(localStorage.getItem(`deleted_notifs_${user.id}`) || '[]')

    readList.forEach(n => {
      if (!deletedIds.includes(n.id)) deletedIds.push(n.id)
    })
    localStorage.setItem(`deleted_notifs_${user.id}`, JSON.stringify(deletedIds))

    setNotifications(prev => prev.filter(n => !n.is_read))
    window.dispatchEvent(new Event('notifs_changed'))
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    refresh: fetchNotifications
  }
}
