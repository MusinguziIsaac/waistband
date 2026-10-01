import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import { reportService } from '../../services/reportService'
import { supabase } from '../../services/supabase'
import StatCard from '../../components/StatCard/StatCard'
import WeeklySalesChart from '../../components/Charts/WeeklySalesChart'
import { formatUGX, formatNumber, todayStr, formatDateShort } from '../../utils/formatting'
import { aggregateSummary } from '../../utils/calculations'
import {
  Package,
  Share2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CreditCard,
  Target,
  BarChart3,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
  AlertTriangle
} from 'lucide-react'

import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [dailyData, setDailyData] = useState(null)
  const [weeklyData, setWeeklyData] = useState(null)
  const [weeklyDailyData, setWeeklyDailyData] = useState([])
  const [stockStatus, setStockStatus] = useState(null)
  const [chartView, setChartView] = useState('daily')
  
  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const today = todayStr()
      const [dailyRes, weeklyRes, dailyBreakdown, stockInfo] = await Promise.all([
        reportService.generateDailyReport(user.id, today),
        reportService.generateWeeklyReport(user.id, today),
        reportService.getWeeklyDailyBreakdown(user.id, today),
        salesService.getOverallStockStatus(user.id, today)
      ])
      
      setDailyData(dailyRes)
      setWeeklyData(weeklyRes)
      setWeeklyDailyData(dailyBreakdown || [])
      setStockStatus(stockInfo)
    } catch (e) {
      setError('Failed to load dashboard data.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Real-time DB subscription
  useRealtimeRefresh(['daily_voucher_balances', 'direct_sales', 'agent_sales', 'voucher_distributions'], loadDashboard, !!user)

  const totals = dailyData?.summary ? aggregateSummary(dailyData.summary) : null
  const weeklyTotals = weeklyData?.summary ? aggregateSummary(weeklyData.summary) : null

  const availableStockInHand = stockStatus?.totalStockInHand ?? (totals?.total_unsold || totals?.total_available || 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back, {profile?.full_name || 'Marketer'}. Here's your summary for today.</p>
      </div>

      {error && <div className="alert-danger mb-6"><AlertCircle size={16} />{error}</div>}

      {/* Morning Available Stock Reminder Banner */}
      {!loading && (
        <div className="bg-white border border-border rounded-2xl p-5 sm:p-6 mb-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-emerald-600" />
                  Live Inventory Reminder
                </span>
                {!stockStatus?.hasRecordedToday && (
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    Carried Over from Previous Stock
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatNumber(availableStockInHand)} Vouchers Available in Hand
              </h2>
              <p className="text-text-secondary text-sm mt-1 max-w-xl">
                Ready for today's sales and distributions. Your unsold vouchers carry forward automatically so you never start your morning at zero.
              </p>

              {/* Package Breakdown Chips */}
              {stockStatus?.breakdown && stockStatus.breakdown.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {stockStatus.breakdown.map(pkg => (
                    <div
                      key={pkg.package_id}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
                    >
                      <span className="font-medium text-slate-600">{pkg.name} ({formatUGX(pkg.face_value)}):</span>
                      <strong className={`font-extrabold ${pkg.available === 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {formatNumber(pkg.available)} pcs
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <Link
                to="/daily-sales"
                className="btn-primary font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all duration-150 active:scale-95"
              >
                <Plus size={16} />
                {stockStatus?.hasRecordedToday ? 'Manage Today\'s Stock' : 'Record Boss Stock'}
              </Link>
              <Link
                to="/distribution"
                className="btn-secondary font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all duration-150 active:scale-95"
              >
                <Share2 size={16} className="text-primary-600" />
                Give to Agents
              </Link>
              <Link
                to="/direct-sales"
                className="btn-secondary font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all duration-150 active:scale-95"
              >
                <TrendingUp size={16} className="text-emerald-600" />
                Direct Sale
              </Link>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="stat-card skeleton h-28" />)}
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Today's Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Total Available" 
              value={formatNumber(totals?.total_available || 0)} 
              subtitle="Vouchers in your stock"
              icon={Package} 
              color="info" 
            />
            <StatCard 
              title="Distributed" 
              value={formatNumber(totals?.distributed_qty || 0)} 
              subtitle="Sent to agents"
              icon={Share2} 
              color="warning" 
            />
            <StatCard 
              title="Direct Sold" 
              value={formatNumber(totals?.direct_sales_qty || 0)} 
              subtitle="Sold by you"
              icon={TrendingUp} 
              color="success" 
            />
            <StatCard 
              title="Agent Sold" 
              value={formatNumber(totals?.agent_sales_qty || 0)} 
              subtitle="Sold by agents"
              icon={Users} 
              color="primary" 
            />
          </div>

          <h2 className="text-lg font-semibold text-text-primary mb-3 mt-8">Money Summary (Today)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Expected Money" 
              value={formatUGX(totals?.expected_revenue || 0)} 
              subtitle="Expected from sales today"
              icon={Target} 
              color="neutral" 
            />
            <StatCard 
              title="Money Collected" 
              value={formatUGX(totals?.amount_received || 0)} 
              subtitle="Cash received today"
              icon={DollarSign} 
              color="success" 
            />
            <StatCard 
              title="Cash Difference" 
              value={formatUGX(totals?.variance || 0)} 
              subtitle={(totals?.variance || 0) >= 0 ? 'Balanced / Extra Cash' : 'Money Shortage'}
              icon={CreditCard} 
              color={(totals?.variance || 0) >= 0 ? 'success' : 'danger'} 
            />
            <StatCard 
              title="Unsold Vouchers" 
              value={formatNumber(totals?.total_unsold || 0)} 
              subtitle="Stock remaining"
              icon={BarChart3} 
              color="info" 
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 card">
              <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text-primary">Sales Performance Chart</h3>
                  {weeklyData?.dateFrom && (
                    <p className="text-xs font-medium text-text-secondary mt-0.5">
                      {formatDateShort(weeklyData.dateFrom)} — {formatDateShort(weeklyData.dateTo)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="form-select text-xs py-1 px-2.5 h-8 bg-muted rounded-md border-border font-medium text-text-primary"
                    value={chartView}
                    onChange={(e) => setChartView(e.target.value)}
                  >
                    <option value="daily">Daily Breakdown (Mon - Sun)</option>
                    <option value="package">Package Breakdown (By Tier)</option>
                  </select>
                </div>
              </div>
              <div className="card-body">
                <WeeklySalesChart
                  data={chartView === 'daily' ? weeklyDailyData : (weeklyData?.summary || [])}
                  viewType={chartView}
                />
              </div>
            </div>
            
            <div className="lg:col-span-1 card">
              <div className="card-header">
                <h3 className="font-semibold">Weekly Summary</h3>
              </div>
              <div className="card-body space-y-6">
                <div>
                  <div className="text-sm text-text-secondary mb-1">Total Expected</div>
                  <div className="text-xl font-bold text-text-primary">{formatUGX(weeklyTotals?.expected_revenue || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-text-secondary mb-1">Total Received</div>
                  <div className="text-xl font-bold text-primary-600">{formatUGX(weeklyTotals?.amount_received || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-text-secondary mb-1">Weekly Variance</div>
                  <div className={`text-xl font-bold ${(weeklyTotals?.variance || 0) >= 0 ? 'text-primary-600' : 'text-danger'}`}>
                    {formatUGX(weeklyTotals?.variance || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UsersIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
