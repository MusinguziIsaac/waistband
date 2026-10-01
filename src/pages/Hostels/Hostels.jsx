import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { hostelService, DEFAULT_HOSTELS } from '../../services/hostelService'
import { salesService } from '../../services/salesService'
import { reportService } from '../../services/reportService'
import Modal from '../../components/Modal/Modal'
import StatCard from '../../components/StatCard/StatCard'
import { formatUGX, formatNumber, formatDate, formatDateShort, todayStr } from '../../utils/formatting'
import {
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  Users,
  Search,
  Check,
  TrendingUp,
  DollarSign,
  Calendar,
  ShoppingBag,
  Printer,
  Wand2,
  Phone,
  User
} from 'lucide-react'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

const TIER_NAMES = {
  500:   'Economy',
  1000:  'Daily',
  6000:  'Weekly',
  20000: 'Monthly',
  80000: 'Semester',
}

const DEFAULT_PACKAGES = [
  { id: '00000000-0000-4000-a000-000000000500', name: 'Economy',  face_value: 500 },
  { id: '00000000-0000-4000-a000-000000001000', name: 'Daily',    face_value: 1000 },
  { id: '00000000-0000-4000-a000-000000006000', name: 'Weekly',   face_value: 6000 },
  { id: '00000000-0000-4000-a000-000000020000', name: 'Monthly',  face_value: 20000 },
  { id: '00000000-0000-4000-a000-000000080000', name: 'Semester', face_value: 80000 },
]

export default function Hostels() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'reports'

  // Hostels state
  const [hostels, setHostels] = useState([])
  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Hostel Registration Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editHostel, setEditHostel] = useState(null)
  const [form, setForm] = useState({
    name: '',
    location: '',
    manager_name: '',
    phone: '',
    rooms_count: '',
    residents_count: '',
    status: 'active',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [seedLoading, setSeedLoading] = useState(false)

  // Direct Hostel Sale Modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [selectedHostelForSale, setSelectedHostelForSale] = useState(null)
  const [saleForm, setSaleForm] = useState({
    hostel_id: '',
    sale_type: 'direct', // 'direct' | 'agent'
    package_id: '',
    agent_id: '',
    sales_date: todayStr(),
    quantity: '',
    amount_received: '',
    notes: ''
  })

  // Report state
  const [reportHostelId, setReportHostelId] = useState('all')
  const [reportType, setReportType] = useState('daily') // 'daily' | 'weekly' | 'custom'
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [reportData, setReportData] = useState([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [hst, pkgs, agts] = await Promise.all([
        hostelService.getHostels(user.id),
        salesService.getPackages(),
        salesService.getAgents(user.id)
      ])
      setHostels(hst || [])
      if (pkgs && pkgs.length > 0) setPackages(pkgs)
      setAgents(agts || [])
    } catch (e) {
      console.error(e)
      setError('Failed to load hostels.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // Realtime updates
  useRealtimeRefresh(['hostels', 'direct_sales', 'agent_sales'], loadData, !!user)

  // Report loader
  const loadReport = useCallback(async () => {
    if (!user) return
    setLoadingReport(true)
    try {
      const data = await hostelService.getHostelSalesReport(user.id, {
        hostelId: reportHostelId,
        dateFrom,
        dateTo
      })
      setReportData(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingReport(false)
    }
  }, [user, reportHostelId, dateFrom, dateTo])

  useEffect(() => {
    loadReport()
  }, [loadReport, activeTab])

  const openAddModal = () => {
    setEditHostel(null)
    setForm({
      name: '',
      location: '',
      manager_name: '',
      phone: '',
      rooms_count: '',
      residents_count: '',
      status: 'active',
      notes: ''
    })
    setModalOpen(true)
  }

  const openEditModal = (h) => {
    setEditHostel(h)
    setForm({
      name: h.name,
      location: h.location,
      manager_name: h.manager_name || '',
      phone: h.phone || '',
      rooms_count: h.rooms_count ? String(h.rooms_count) : '',
      residents_count: h.residents_count ? String(h.residents_count) : '',
      status: h.status || 'active',
      notes: h.notes || ''
    })
    setModalOpen(true)
  }

  const openRecordSaleModal = (h = null) => {
    const targetHostel = h || hostels[0]
    setSelectedHostelForSale(targetHostel)
    setSaleForm({
      hostel_id: targetHostel ? targetHostel.id : (hostels[0]?.id || ''),
      sale_type: 'direct',
      package_id: packages[0]?.id || DEFAULT_PACKAGES[0].id,
      agent_id: agents[0]?.id || '',
      sales_date: todayStr(),
      quantity: '',
      amount_received: '',
      notes: ''
    })
    setSaleModalOpen(true)
  }

  const handleSeedDefaultHostels = async () => {
    setSeedLoading(true)
    setError('')
    try {
      const seeded = await hostelService.syncDefaultResidentCounts(user.id)
      if (seeded && seeded.length > 0) {
        setSuccess(`Loaded & synced resident counts for ${seeded.length} hostels successfully!`)
        await loadData()
        setTimeout(() => setSuccess(''), 6000)
      } else {
        setError('Could not load or sync default hostels.')
      }
    } catch (e) {
      setError(e.message || 'Failed to sync default hostels.')
    } finally {
      setSeedLoading(false)
    }
  }

  const handleSaveHostel = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editHostel) {
        await hostelService.updateHostel(editHostel.id, form)
        setSuccess('Hostel details updated successfully.')
      } else {
        await hostelService.createHostel(user.id, form)
        setSuccess('New Hostel/Rental registered successfully!')
      }
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save hostel.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveHostelSale = async (e) => {
    e.preventDefault()
    const qty = parseInt(saleForm.quantity) || 0
    if (qty <= 0) {
      setError('Please enter a valid quantity of vouchers sold.')
      return
    }

    const targetHostelId = saleForm.hostel_id || selectedHostelForSale?.id
    if (!targetHostelId) {
      setError('Please select a hostel for this sale.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (saleForm.sale_type === 'direct') {
        await salesService.createDirectSale(user.id, {
          package_id: saleForm.package_id,
          hostel_id: targetHostelId,
          sales_date: saleForm.sales_date,
          quantity: qty,
          amount_received: parseFloat(saleForm.amount_received) || 0,
          notes: saleForm.notes
        })
      } else {
        if (!saleForm.agent_id) {
          setError('Please select an agent for this sale.')
          setSaving(false)
          return
        }
        await salesService.createAgentSale(user.id, {
          agent_id: saleForm.agent_id,
          package_id: saleForm.package_id,
          hostel_id: targetHostelId,
          sales_date: saleForm.sales_date,
          initial_vouchers_given: qty,
          quantity: qty,
          amount_received: parseFloat(saleForm.amount_received) || 0,
          notes: saleForm.notes
        })
      }

      const hName = hostels.find(h => h.id === targetHostelId)?.name || 'Hostel'
      setSuccess(`Sale of ${qty} vouchers for ${hName} saved successfully!`)
      setSaleModalOpen(false)
      await loadData()
      await loadReport()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save hostel sale.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteHostel = async () => {
    try {
      await hostelService.deleteHostel(deleteId)
      setDeleteId(null)
      await loadData()
      setSuccess('Hostel record deleted.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to delete hostel.')
    }
  }

  const handleReportTypeChange = (type) => {
    setReportType(type)
    const today = todayStr()
    if (type === 'daily') {
      setDateFrom(today)
      setDateTo(today)
    } else if (type === 'weekly') {
      const d = new Date()
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const startOfWeek = new Date(d)
      startOfWeek.setDate(d.getDate() + diff)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      
      const formatLocal = (dt) => dt.toISOString().split('T')[0]
      setDateFrom(formatLocal(startOfWeek))
      setDateTo(formatLocal(endOfWeek))
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    if (!reportData || reportData.length === 0) return
    setDownloadingPdf(true)
    try {
      const pdfPayload = {
        type: `Hostel Sales (${reportType.toUpperCase()})`,
        dateFrom,
        dateTo,
        summary: reportData
      }
      await reportService.downloadPDF(pdfPayload, profile, 'hostel-report-preview-content')
    } catch (e) {
      console.error('Failed to export Hostel PDF:', e)
      setError('Failed to download PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const exportHostelCSV = () => {
    if (!reportData || reportData.length === 0) return
    const headers = [
      'Hostel / Rental Name',
      'Location',
      'Package',
      'Residents',
      'Qty Sold',
      'Expected Revenue (UGX)',
      'Money Collected (UGX)',
      'Cash Difference (UGX)'
    ]
    const rows = reportData.map(r => [
      `"${r.hostel_name}"`,
      `"${r.location}"`,
      `"${r.package_name || '—'}"`,
      r.residents_count || 0,
      r.total_sold_qty,
      r.expected_revenue,
      r.amount_received,
      r.variance
    ])
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Hostel_Sales_Report_${dateFrom}_to_${dateTo}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredHostels = hostels.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.manager_name && h.manager_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalResidents = hostels.reduce((sum, h) => sum + (h.residents_count || 0), 0)
  const totalHostelSalesQty = reportData.reduce((sum, r) => sum + r.total_sold_qty, 0)
  const totalHostelExpected = reportData.reduce((sum, r) => sum + r.expected_revenue, 0)
  const totalHostelRevenue = reportData.reduce((sum, r) => sum + r.amount_received, 0)
  const totalHostelVariance = reportData.reduce((sum, r) => sum + r.variance, 0)

  const selectedPkgForSale = packages.find(p => p.id === saleForm.package_id) || packages[0]
  const expectedSaleRev = (parseInt(saleForm.quantity) || 0) * Number(selectedPkgForSale?.face_value || 0)

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="text-emerald-600" size={28} />
            Hostels & Rentals Management
          </h1>
          <p className="page-subtitle">Register WiFi sales locations and record sales made in each hostel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openRecordSaleModal()}
            className="btn-emerald bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            disabled={hostels.length === 0}
          >
            <ShoppingBag size={16} /> Enter Hostel Sale
          </button>
          <button
            onClick={handleSeedDefaultHostels}
            disabled={seedLoading}
            className="btn-secondary text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5"
            title="Load default hostels or sync resident counts with defaults"
          >
            <Wand2 size={16} className="text-emerald-600" />
            {seedLoading ? 'Syncing...' : 'Sync Resident Counts'}
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'list' ? 'reports' : 'list')}
            className="btn-secondary"
          >
            <FileText size={16} />
            {activeTab === 'list' ? 'Hostel Sales Reports' : 'Registered Hostels'}
          </button>
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={16} /> Register New Hostel
          </button>
        </div>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Registered Hostels"
          value={formatNumber(hostels.length)}
          subtitle="Active sales locations"
          icon={Building2}
          color="info"
        />
        <StatCard
          title="Total Residents"
          value={formatNumber(totalResidents)}
          subtitle="Estimated total residents"
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Hostel Vouchers Sold"
          value={formatNumber(totalHostelSalesQty)}
          subtitle="In selected report period"
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Hostel Revenue"
          value={formatUGX(totalHostelRevenue)}
          subtitle="Cash collected"
          icon={DollarSign}
          color="neutral"
        />
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'list'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Building2 size={16} />
          Registered Hostels ({hostels.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText size={16} />
          Hostel Sales Reports
        </button>
      </div>

      {/* TAB 1: Registered Hostels List */}
      {activeTab === 'list' && (
        <div>
          {/* Search bar */}
          <div className="card mb-6">
            <div className="card-body py-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search hostel by name, location, or manager..."
                  className="form-input pl-10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card p-8 text-center text-text-secondary">Loading registered hostels...</div>
          ) : filteredHostels.length === 0 ? (
            <div className="card text-center py-12">
              <Building2 size={44} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-text-primary text-base font-bold">No hostels or rentals registered yet</p>
              <p className="text-text-secondary text-sm mt-1 max-w-md mx-auto">
                Load default hostels with pre-filled manager names &amp; contacts, or register a new one manually.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5">
                <button
                  onClick={handleSeedDefaultHostels}
                  disabled={seedLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow transition-colors disabled:opacity-60"
                >
                  <Wand2 size={16} />
                  {seedLoading ? 'Loading Default Hostels...' : `Load ${DEFAULT_HOSTELS.length} Default Hostels`}
                </button>
                <button onClick={openAddModal} className="btn-secondary">
                  <Plus size={16} /> Add Hostel Manually
                </button>
              </div>
              <p className="text-text-secondary text-xs mt-4 max-w-sm mx-auto">
                Default hostels include pre-set manager names &amp; phone numbers that you can edit anytime.
              </p>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hostel / Rental Name</th>
                      <th>Location / Address</th>
                      <th>Manager / Contact</th>
                      <th>Phone</th>
                      <th className="text-center">Residents</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHostels.map(h => (
                      <tr key={h.id}>
                        <td className="font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-emerald-600 shrink-0" />
                            {h.name}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-text-secondary">
                            <MapPin size={14} className="text-amber-600 shrink-0" />
                            {h.location}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-800">{h.manager_name || <span className="text-xs text-text-secondary italic">Not set</span>}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span className="text-sm">{h.phone || <span className="text-xs text-text-secondary italic">Not set</span>}</span>
                          </div>
                        </td>
                        <td className="text-center font-bold text-emerald-700">{h.residents_count || 0}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            h.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {h.status || 'active'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openRecordSaleModal(h)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold py-1 px-2.5 rounded-md flex items-center gap-1 transition-colors"
                              title="Enter Sales Made at this Hostel"
                            >
                              <ShoppingBag size={13} /> Enter Sale
                            </button>
                            <button
                              onClick={() => {
                                setReportHostelId(h.id)
                                setActiveTab('reports')
                              }}
                              className="btn-ghost btn-sm text-primary p-1.5"
                              title="View Sales Report"
                            >
                              <FileText size={14} />
                            </button>
                            <button onClick={() => openEditModal(h)} className="btn-ghost btn-sm p-1.5" title="Edit Hostel">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setDeleteId(h.id)} className="btn-ghost btn-sm text-danger hover:bg-red-50 p-1.5" title="Delete Hostel">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Hostel Sales Reports */}
      {activeTab === 'reports' && (
        <div>
          {/* Report Filter Controls */}
          <div className="card mb-6 no-print">
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="form-label font-medium">Select Hostel / Location</label>
                  <select
                    className="form-select"
                    value={reportHostelId}
                    onChange={e => setReportHostelId(e.target.value)}
                  >
                    <option value="all">All Registered Hostels</option>
                    {hostels.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.location})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-medium">Report Period</label>
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleReportTypeChange('daily')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-colors ${
                        reportType === 'daily' ? 'bg-white shadow text-primary' : 'text-text-secondary'
                      }`}
                    >
                      Daily Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportTypeChange('weekly')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-colors ${
                        reportType === 'weekly' ? 'bg-white shadow text-primary' : 'text-text-secondary'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportTypeChange('custom')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-colors ${
                        reportType === 'custom' ? 'bg-white shadow text-primary' : 'text-text-secondary'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label font-medium">Date From</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateFrom}
                    onChange={e => {
                      setDateFrom(e.target.value)
                      setReportType('custom')
                    }}
                  />
                </div>

                <div>
                  <label className="form-label font-medium">Date To</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateTo}
                    onChange={e => {
                      setDateTo(e.target.value)
                      setReportType('custom')
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button onClick={handlePrint} className="btn-secondary" disabled={reportData.length === 0}>
                  <Printer size={16} /> Print Report
                </button>
                <button onClick={handleDownloadPDF} className="btn-secondary" disabled={downloadingPdf || reportData.length === 0}>
                  <Download size={16} /> {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button onClick={exportHostelCSV} className="btn-secondary" disabled={reportData.length === 0}>
                  <Download size={16} /> Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Branded Hostel Report Preview Container (Exact PDF & Print Target) */}
          {loadingReport ? (
            <div className="card p-8 text-center text-text-secondary">Generating hostel sales report...</div>
          ) : reportData.length === 0 ? (
            <div className="card text-center py-12">
              <FileText size={44} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-text-primary text-base font-bold">No sales data recorded for hostels in this timeframe</p>
              <p className="text-text-secondary text-sm mt-1 max-w-md mx-auto">
                Tag your direct sales or agent sales to registered hostels to see detailed location-based revenue reports here.
              </p>
            </div>
          ) : (
            <div className="card p-2 sm:p-4 bg-white">
              <div id="hostel-report-preview-content" className="bg-white p-4 rounded-lg">
                {/* Official WAISTBAND Header */}
                <div className="bg-primary p-5 rounded-lg text-white mb-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="WAISTBAND HUB LTD Logo" className="h-14 w-14 object-contain filter drop-shadow-[0_2px_8px_rgba(34,197,94,0.4)]" />
                      <div>
                        <h2 className="text-xl font-bold">WAISTBAND HUB LTD</h2>
                        <p className="text-primary-100 text-sm mt-0.5">Fast &amp; Reliable Internet — Hostel WiFi Sales Report</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg uppercase">Hostel Sales Report</div>
                      <div className="text-primary-100 text-sm mt-0.5">
                        {dateFrom === dateTo
                          ? formatDate(dateFrom)
                          : `${formatDateShort(dateFrom)} to ${formatDateShort(dateTo)}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary-400 flex flex-wrap gap-x-6 gap-y-1 text-sm text-primary-100">
                    <span>Marketer: <strong className="text-white">{profile?.full_name || 'General Marketer'}</strong></span>
                    <span>Target Location: <strong className="text-white">{reportHostelId === 'all' ? 'All Registered Hostels' : (hostels.find(h => h.id === reportHostelId)?.name || 'Hostel')}</strong></span>
                    <span>Generated: <strong className="text-white">{new Date().toLocaleString('en-GB')}</strong></span>
                  </div>
                </div>

                {/* Table Breakdown */}
                <div className="table-container mb-6">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Hostel / Rental Location</th>
                        <th>Location Area</th>
                        <th>Package</th>
                        <th className="text-center">Residents</th>
                        <th className="text-right">Qty Sold</th>
                        <th className="text-right">Expected Revenue</th>
                        <th className="text-right">Money Collected</th>
                        <th className="text-right">Cash Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, idx) => (
                        <tr key={`${r.hostel_id}-${r.package_name}-${idx}`}>
                          <td className="font-bold text-slate-900">{r.hostel_name}</td>
                          <td className="text-text-secondary">{r.location}</td>
                          <td className="font-medium text-primary">{r.package_name || '—'}</td>
                          <td className="text-center text-emerald-700 font-semibold">{r.residents_count || 0}</td>
                          <td className="text-right font-extrabold text-slate-900">{formatNumber(r.total_sold_qty)}</td>
                          <td className="text-right font-semibold">{formatUGX(r.expected_revenue)}</td>
                          <td className="text-right font-bold text-emerald-700">{formatUGX(r.amount_received)}</td>
                          <td className={`text-right font-extrabold ${(r.variance ?? 0) >= 0 ? 'text-emerald-600' : 'text-danger'}`}>
                            {formatUGX(r.variance ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary-50 font-bold border-t-2 border-primary-200 text-slate-900">
                        <td colSpan={2}>TOTALS</td>
                        <td></td>
                        <td className="text-center font-bold text-emerald-800">{formatNumber(reportData.reduce((s, r) => s + (r.residents_count || 0), 0))}</td>
                        <td className="text-right font-extrabold text-primary-700">{formatNumber(totalHostelSalesQty)}</td>
                        <td className="text-right">{formatUGX(totalHostelExpected)}</td>
                        <td className="text-right text-emerald-700">{formatUGX(totalHostelRevenue)}</td>
                        <td className={`text-right ${totalHostelVariance >= 0 ? 'text-emerald-600' : 'text-danger'}`}>{formatUGX(totalHostelVariance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Financial Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <div className="text-xs text-text-secondary font-semibold uppercase mb-1">Expected Money</div>
                    <div className="text-lg font-bold text-text-primary">{formatUGX(totalHostelExpected)}</div>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-4 text-center border border-primary-200">
                    <div className="text-xs text-primary-600 font-semibold uppercase mb-1">Money Collected</div>
                    <div className="text-lg font-bold text-primary-700">{formatUGX(totalHostelRevenue)}</div>
                  </div>
                  <div className={`rounded-lg p-4 text-center border ${totalHostelVariance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className={`text-xs font-semibold uppercase mb-1 ${totalHostelVariance >= 0 ? 'text-emerald-700' : 'text-danger'}`}>Cash Difference</div>
                    <div className={`text-lg font-bold ${totalHostelVariance >= 0 ? 'text-emerald-700' : 'text-danger'}`}>{formatUGX(totalHostelVariance)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Register / Edit Hostel */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editHostel ? 'Edit Hostel / Rental Details' : 'Register New Hostel / Rental'}
      >
        <form onSubmit={handleSaveHostel}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

            <div>
              <label className="form-label font-bold text-slate-900">Hostel / Rental Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Bavaria Hostel, Nana Court"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="form-label font-bold text-slate-900">Location / Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Kikoni, Makerere / Plot 42 West Lane"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-medium">Manager / Caretaker Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. David Musoke"
                  value={form.manager_name}
                  onChange={e => setForm(p => ({ ...p, manager_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label font-medium">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 0770000000"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-medium">Number of Residents</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  placeholder="e.g. 250"
                  value={form.residents_count}
                  onChange={e => setForm(p => ({ ...p, residents_count: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label font-medium">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active (WiFi Live)</option>
                  <option value="inactive">Inactive / Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label font-medium">Notes / Details (optional)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Router placed on 2nd floor, agent assigned: Alex"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editHostel ? 'Update Hostel' : 'Register Hostel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Record Sales for Hostel */}
      <Modal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        title={`Enter Sales Made at ${selectedHostelForSale?.name || 'Hostel'}`}
      >
        <form onSubmit={handleSaveHostelSale}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

            <div>
              <label className="form-label font-bold text-slate-900">Select Hostel / Rental</label>
              <select
                className="form-select font-semibold"
                value={saleForm.hostel_id}
                onChange={e => {
                  const hId = e.target.value
                  setSaleForm(p => ({ ...p, hostel_id: hId }))
                  setSelectedHostelForSale(hostels.find(h => h.id === hId))
                }}
                required
              >
                <option value="">Choose hostel...</option>
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.location})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-medium">Sale Type</label>
                <select
                  className="form-select"
                  value={saleForm.sale_type}
                  onChange={e => setSaleForm(p => ({ ...p, sale_type: e.target.value }))}
                >
                  <option value="direct">Direct Sale (Sold by You)</option>
                  <option value="agent">Agent Sale (Sold by Agent)</option>
                </select>
              </div>

              <div>
                <label className="form-label font-medium">Sales Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={saleForm.sales_date}
                  onChange={e => setSaleForm(p => ({ ...p, sales_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {saleForm.sale_type === 'agent' && (
              <div>
                <label className="form-label font-bold text-slate-900">Select Agent</label>
                <select
                  className="form-select"
                  value={saleForm.agent_id}
                  onChange={e => setSaleForm(p => ({ ...p, agent_id: e.target.value }))}
                  required
                >
                  <option value="">Choose Agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.full_name} ({a.location || 'No location'})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="form-label font-medium">Voucher Package Tier</label>
              <select
                className="form-select font-medium"
                value={saleForm.package_id}
                onChange={e => setSaleForm(p => ({ ...p, package_id: e.target.value }))}
                required
              >
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {TIER_NAMES[Number(pkg.face_value)] || pkg.name}: Ush {Number(pkg.face_value).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-bold text-slate-900">Number of Vouchers Sold</label>
                <input
                  type="number"
                  min={1}
                  className="form-input font-bold text-primary-700"
                  placeholder="e.g. 15"
                  value={saleForm.quantity}
                  onChange={e => setSaleForm(p => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label font-bold text-slate-900">Amount Received (UGX)</label>
                <input
                  type="number"
                  min={0}
                  className="form-input font-bold text-emerald-700"
                  placeholder="e.g. 15000"
                  value={saleForm.amount_received}
                  onChange={e => setSaleForm(p => ({ ...p, amount_received: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="bg-primary-50 rounded-lg p-3 text-sm flex items-center justify-between border border-primary-100">
              <span className="text-primary-800 font-medium">Expected Revenue:</span>
              <span className="font-extrabold text-primary-900">{formatUGX(expectedSaleRev)}</span>
            </div>

            <div>
              <label className="form-label font-medium">Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Room 12 student, cash payment"
                value={saleForm.notes}
                onChange={e => setSaleForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setSaleModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Hostel Sale'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Delete Confirmation */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Hostel Record">
        <div className="modal-body">
          <p className="text-text-secondary">
            Are you sure you want to delete this hostel? Previous sales associated with this hostel will remain saved in sales history.
          </p>
        </div>
        <div className="modal-footer">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDeleteHostel} className="btn-danger">Delete Hostel</button>
        </div>
      </Modal>
    </div>
  )
}
