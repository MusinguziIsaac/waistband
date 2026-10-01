import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { reportService } from '../../services/reportService'
import {
  formatDate,
  formatDateShort,
  formatUGX,
  formatNumber,
  formatDateTime,
  todayStr,
  yesterdayStr,
  varianceClass,
  formatPackageDisplayName,
  dedupeAndNormalizeSummary
} from '../../utils/formatting'
import { aggregateSummary } from '../../utils/calculations'
import {
  FileText,
  Download,
  Send,
  Eye,
  AlertCircle,
  CheckCircle,
  Printer,
  Calendar,
  Clock,
  Edit3,
  RotateCcw,
  Package,
  Share2,
  TrendingUp,
  DollarSign,
  Trash2,
  Sparkles,
  ExternalLink,
  Check
} from 'lucide-react'
import Modal from '../../components/Modal/Modal'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

export default function Reports() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || yesterdayStr()

  const [reportType, setReportType] = useState('daily')
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [originalSummary, setOriginalSummary] = useState(null)
  const [isEditingReport, setIsEditingReport] = useState(false)

  const [savedReports, setSavedReports] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingHistoryPdf, setDownloadingHistoryPdf] = useState(null)

  const isToday = selectedDate === todayStr()
  const isYesterday = selectedDate === yesterdayStr()

  const loadHistory = useCallback(async () => {
    if (!user) return
    setLoadingHistory(true)
    try {
      const data = await reportService.getReports(user.id)
      setSavedReports(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }, [user])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Real-time DB subscription
  useRealtimeRefresh(
    ['reports', 'daily_voucher_balances', 'direct_sales', 'agent_sales', 'voucher_distributions'],
    loadHistory,
    !!user
  )

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setReportData(null)
    setOriginalSummary(null)
    setIsEditingReport(false)
    try {
      let data
      if (reportType === 'daily') {
        data = await reportService.generateDailyReport(user.id, selectedDate)
      } else {
        data = await reportService.generateWeeklyReport(user.id, selectedDate)
      }
      setReportData(data)
      setOriginalSummary(JSON.parse(JSON.stringify(data.summary || [])))
      setPreviewOpen(true)
    } catch (e) {
      setError(e.message || 'Failed to generate report.')
    } finally {
      setGenerating(false)
    }
  }

  const handleRowChange = (index, field, value) => {
    if (!reportData?.summary) return
    const updated = [...reportData.summary]
    const row = { ...updated[index] }
    const numVal = Math.max(0, parseInt(value) || 0)

    row[field] = numVal

    // Recalculate computed fields for this package
    const initial = Number(row.initial_qty || 0)
    const additional = Number(row.additional_qty || 0)
    const totalAvail = initial + additional
    const dist = Number(row.distributed_qty || 0)
    const direct = Number(row.direct_sales_qty || 0)
    const agent = Number(row.agent_sales_qty || 0)
    const fVal = Number(row.face_value || 0)

    row.total_available = totalAvail
    row.total_sold_qty = direct + agent
    row.total_unsold = Math.max(0, totalAvail - dist - direct)

    if (field !== 'expected_revenue') {
      row.expected_revenue = (direct * fVal) + (agent * fVal)
    }
    if (field === 'amount_received' || field === 'expected_revenue' || field === 'direct_sales_qty' || field === 'agent_sales_qty') {
      row.variance = (Number(row.amount_received || 0)) - Number(row.expected_revenue || 0)
    }

    updated[index] = row
    setReportData(prev => ({ ...prev, summary: updated }))
  }

  const handleResetToOriginal = () => {
    if (originalSummary) {
      setReportData(prev => ({ ...prev, summary: JSON.parse(JSON.stringify(originalSummary)) }))
    }
  }

  const handleSave = async () => {
    if (!reportData) return
    setSaving(true)
    try {
      await reportService.saveReport(user.id, reportData)
      setSuccess('Report draft saved successfully.')
      await loadHistory()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save report.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (reportId) => {
    setSubmitting(reportId)
    try {
      await reportService.submitReport(reportId, user.id)
      await loadHistory()
      setSuccess('Report submitted to management successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to submit report.')
    } finally {
      setSubmitting(null)
    }
  }

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this saved report draft?')) return
    try {
      await reportService.deleteReport(reportId, user.id)
      await loadHistory()
      setSuccess('Report removed successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError('Failed to delete report.')
    }
  }

  const handleViewSavedReport = (r, editMode = false) => {
    const data = {
      id: r.id,
      type: r.report_type === 'daily' ? 'Daily' : 'Weekly',
      dateFrom: r.date_from,
      dateTo: r.date_to,
      summary: dedupeAndNormalizeSummary(r.summary_data || []),
      status: r.status
    }
    setReportData(data)
    setOriginalSummary(JSON.parse(JSON.stringify(data.summary)))
    setIsEditingReport(editMode)
    setPreviewOpen(true)
  }

  const handleDownloadPDF = async () => {
    if (!reportData) return
    setDownloadingPdf(true)
    try {
      await reportService.downloadPDF(reportData, profile, 'report-preview-content')
    } catch (e) {
      console.error('Failed to export PDF:', e)
      setError('Failed to download PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadHistoryPDF = async (r) => {
    setDownloadingHistoryPdf(r.id)
    try {
      const data = {
        type: r.report_type === 'daily' ? 'Daily' : 'Weekly',
        dateFrom: r.date_from,
        dateTo: r.date_to,
        summary: dedupeAndNormalizeSummary(r.summary_data || [])
      }
      await reportService.downloadPDF(data, profile, null)
    } catch (e) {
      console.error(e)
      setError('Failed to download PDF')
    } finally {
      setDownloadingHistoryPdf(null)
    }
  }

  const handleDownloadCSV = (dataToExport = reportData) => {
    if (!dataToExport) return
    reportService.exportCSV(dataToExport)
  }

  const handlePrint = () => window.print()

  const totals = useMemo(() => {
    return reportData?.summary ? aggregateSummary(reportData.summary) : null
  }, [reportData?.summary])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="text-primary-600" size={24} />
            <span>Sales &amp; Stock Reports</span>
          </h1>
          <p className="page-subtitle">
            Generate, edit, download, and submit daily or weekly sales reports for today or any previous day.
          </p>
        </div>

        {/* Quick Yesterday / Today Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedDate(yesterdayStr()); setReportType('daily') }}
            className={`btn-sm font-bold flex items-center gap-1.5 rounded-lg border transition-all ${
              isYesterday
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-text-secondary border-border hover:bg-gray-50'
            }`}
          >
            <Clock size={14} />
            <span>Yesterday's Report</span>
          </button>
          <button
            onClick={() => { setSelectedDate(todayStr()); setReportType('daily') }}
            className={`btn-sm font-bold flex items-center gap-1.5 rounded-lg border transition-all ${
              isToday
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-text-secondary border-border hover:bg-gray-50'
            }`}
          >
            <Calendar size={14} />
            <span>Today</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Generator & Quick Date Selection Card */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
              <span>Generate Report</span>
            </h3>
            <p className="text-text-secondary text-xs mt-0.5">
              Select date to compile live stock, direct sales, agent collections, and cash reconciliation.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            <span>Target:</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
              {isYesterday ? 'Yesterday' : isToday ? 'Today' : formatDateShort(selectedDate)} ({formatDate(selectedDate)})
            </span>
          </div>
        </div>

        <div className="card-body py-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="form-label text-xs">Report Type</label>
                <select
                  className="form-select text-sm h-10"
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                >
                  <option value="daily">Daily Report (Single Day)</option>
                  <option value="weekly">Weekly Report (Full Week)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">
                  {reportType === 'daily' ? 'Report Date' : 'Any Date in Week'}
                </label>
                <input
                  type="date"
                  className="form-input text-sm h-10 font-medium"
                  value={selectedDate}
                  max={todayStr()}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayStr())}
                  className={`btn-secondary btn-sm h-10 px-3 text-xs font-bold flex-1 ${isYesterday ? 'border-primary-500 bg-primary-50 text-primary-700' : ''}`}
                  title="Select Yesterday"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr())}
                  className={`btn-secondary btn-sm h-10 px-3 text-xs font-bold flex-1 ${isToday ? 'border-primary-500 bg-primary-50 text-primary-700' : ''}`}
                  title="Select Today"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="shrink-0">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary h-10 px-5 font-bold flex items-center gap-2 shadow-sm w-full sm:w-auto"
              >
                {generating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Eye size={16} />
                    <span>Generate &amp; Preview Report</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Transaction Edit Links for the Selected Date */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="text-text-secondary flex items-center gap-1.5 font-medium">
              <span>Need to adjust or update transactions for <strong>{formatDateShort(selectedDate)}</strong>?</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/daily-sales?date=${selectedDate}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors"
              >
                <Package size={12} className="text-amber-600" />
                <span>Boss Stock</span>
                <ExternalLink size={10} />
              </Link>
              <Link
                to={`/distribution?date=${selectedDate}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors"
              >
                <Share2 size={12} className="text-primary-600" />
                <span>Distributions</span>
                <ExternalLink size={10} />
              </Link>
              <Link
                to={`/direct-sales?date=${selectedDate}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors"
              >
                <TrendingUp size={12} className="text-emerald-600" />
                <span>Direct Sales</span>
                <ExternalLink size={10} />
              </Link>
              <Link
                to={`/agent-sales?date=${selectedDate}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors"
              >
                <DollarSign size={12} className="text-teal-600" />
                <span>Agent Sales</span>
                <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Report History Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">Report History &amp; Saved Drafts</h3>
            <span className="badge-neutral text-xs">{savedReports.length} saved</span>
          </div>
        </div>

        {loadingHistory ? (
          <div className="card-body text-center text-text-secondary py-10">
            <div className="spinner mx-auto mb-2" />
            <span>Loading saved reports...</span>
          </div>
        ) : savedReports.length === 0 ? (
          <div className="card-body text-center py-12">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <FileText size={28} />
            </div>
            <h4 className="text-text-primary font-bold text-sm">No saved reports yet</h4>
            <p className="text-text-secondary text-xs mt-1 max-w-sm mx-auto">
              Select <strong>Yesterday</strong> or <strong>Today</strong> above to generate and preview your daily report, then click "Save Draft" or "Download PDF".
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Submitted</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedReports.map(r => (
                  <tr key={r.id}>
                    <td className="font-bold text-slate-900">
                      {r.date_from === r.date_to
                        ? formatDate(r.date_from)
                        : `${formatDateShort(r.date_from)} — ${formatDateShort(r.date_to)}`}
                    </td>
                    <td>
                      <span className="badge-info capitalize font-bold text-[11px]">
                        {r.report_type}
                      </span>
                    </td>
                    <td>
                      {r.status === 'submitted' ? (
                        <span className="badge-success text-[11px] font-bold inline-flex items-center gap-1">
                          <Check size={11} /> Submitted
                        </span>
                      ) : (
                        <span className="badge-warning text-[11px] font-bold">Draft</span>
                      )}
                    </td>
                    <td className="text-text-secondary text-xs">{formatDateTime(r.created_at)}</td>
                    <td className="text-text-secondary text-xs">{r.submitted_at ? formatDateTime(r.submitted_at) : '—'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewSavedReport(r, false)}
                          className="btn-secondary btn-sm text-xs px-2.5 py-1 flex items-center gap-1"
                          title="View Report Preview"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleViewSavedReport(r, true)}
                          className="btn-ghost btn-sm text-xs px-2.5 py-1 text-primary hover:bg-primary-50 flex items-center gap-1 font-semibold"
                          title="Edit Report Values"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDownloadHistoryPDF(r)}
                          disabled={downloadingHistoryPdf === r.id}
                          className="btn-ghost btn-sm text-xs px-2 py-1 text-text-secondary hover:text-primary hover:bg-gray-100"
                          title="Download PDF"
                        >
                          <Download size={13} />
                          <span className="text-[11px]">PDF</span>
                        </button>

                        <button
                          onClick={() => handleDownloadCSV({
                            type: r.report_type === 'daily' ? 'Daily' : 'Weekly',
                            dateFrom: r.date_from,
                            summary: r.summary_data
                          })}
                          className="btn-ghost btn-sm text-xs px-2 py-1 text-text-secondary hover:text-emerald-700 hover:bg-gray-100"
                          title="Download CSV"
                        >
                          <Download size={13} />
                          <span className="text-[11px]">CSV</span>
                        </button>

                        {r.status === 'draft' && (
                          <button
                            onClick={() => handleSubmit(r.id)}
                            disabled={submitting === r.id}
                            className="btn-primary btn-sm text-xs px-2.5 py-1 flex items-center gap-1 font-bold"
                          >
                            <Send size={12} />
                            <span>{submitting === r.id ? 'Sending...' : 'Submit'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteReport(r.id)}
                          className="btn-ghost btn-sm p-1.5 text-text-secondary hover:text-danger hover:bg-red-50"
                          title="Delete Draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview & Edit Modal */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={isEditingReport ? `Edit Report: ${reportData?.type} (${reportData?.dateFrom})` : `Report Preview: ${reportData?.type} (${reportData?.dateFrom})`}
        size="xl"
      >
        {reportData && (
          <>
            <div className="modal-body space-y-4">
              {/* Mode Switch & Edit Helper Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingReport(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      !isEditingReport ? 'bg-primary text-white shadow-sm' : 'bg-white text-text-secondary border border-border'
                    }`}
                  >
                    <Eye size={13} />
                    <span>Preview Mode</span>
                  </button>
                  <button
                    onClick={() => setIsEditingReport(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      isEditingReport ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-text-secondary border border-border'
                    }`}
                  >
                    <Edit3 size={13} />
                    <span>Edit Numbers</span>
                  </button>
                </div>

                {isEditingReport ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-800 font-semibold">Editing active numbers. Totals &amp; revenue recalculate live.</span>
                    <button
                      onClick={handleResetToOriginal}
                      className="btn-ghost btn-sm text-xs text-text-secondary hover:text-primary flex items-center gap-1 bg-white border border-border px-2 py-1 rounded"
                      title="Reset numbers to live database values"
                    >
                      <RotateCcw size={12} />
                      <span>Reset</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary">
                    <span>Generated from verified database records. Click <strong>Edit Numbers</strong> to adjust values.</span>
                  </div>
                )}
              </div>

              {/* Printable / Renderable Container */}
              <div id="report-preview-content" className="bg-white p-2 sm:p-4 rounded-xl border border-border">
                {/* Brand Header */}
                <div className="bg-white border border-border rounded-xl p-5 mb-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="WAISTBAND HUB LTD Logo"
                        className="h-14 w-14 object-contain filter drop-shadow-[0_2px_8px_rgba(34,197,94,0.3)]"
                      />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">WAISTBAND HUB LTD</h2>
                        <p className="text-text-secondary text-sm mt-0.5">Fast &amp; Reliable Internet</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-sm uppercase tracking-wider px-3 py-1.5 rounded-full">
                        {reportData.type} Report
                      </span>
                      <div className="text-text-secondary text-sm mt-1.5 font-semibold">
                        {reportData.dateFrom === reportData.dateTo
                          ? formatDate(reportData.dateFrom)
                          : `${formatDateShort(reportData.dateFrom)} — ${formatDateShort(reportData.dateTo)}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
                    <span>Marketer: <strong className="text-slate-900">{profile?.full_name || 'General Marketer'}</strong></span>
                    <span>Date Generated: <strong className="text-slate-900">{new Date().toLocaleString('en-GB')}</strong></span>
                  </div>
                </div>

                {/* Accountability Summary Table */}
                {reportData.summary && reportData.summary.length > 0 ? (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center justify-between">
                      <span>Voucher Stock &amp; Revenue Reconciliation</span>
                      {isEditingReport && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Input boxes editable
                        </span>
                      )}
                    </h4>

                    <div className="table-container mb-5 overflow-x-auto">
                      <table className="table text-xs">
                        <thead>
                          <tr>
                            <th>Package</th>
                            <th>Hostel / Rental</th>
                            <th className="text-right">Direct Sales</th>
                            <th className="text-right">Agent Sales</th>
                            <th className="text-right">Total Sold</th>
                            <th className="text-right">Expected Revenue (UGX)</th>
                            <th className="text-right">Amount Received (UGX)</th>
                            <th className="text-right">Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.summary.map((row, idx) => (
                            <tr key={row.package_id || idx} className="hover:bg-slate-50/80">
                              <td className="font-bold text-slate-900 whitespace-nowrap">
                                {formatPackageDisplayName(row)}
                              </td>
                              <td className="text-slate-700 font-medium text-xs">
                                {row.hostel_name || 'All Hostels'}
                              </td>

                              {/* Direct Sales Qty */}
                              <td className="text-right">
                                {isEditingReport ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.direct_sales_qty}
                                    onChange={e => handleRowChange(idx, 'direct_sales_qty', e.target.value)}
                                    className="w-16 px-1.5 py-0.5 text-right border border-amber-300 rounded bg-amber-50/50 font-bold"
                                  />
                                ) : (
                                  formatNumber(Number(row.direct_sales_qty) || 0)
                                )}
                              </td>

                              {/* Agent Sales Qty */}
                              <td className="text-right">
                                {isEditingReport ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.agent_sales_qty}
                                    onChange={e => handleRowChange(idx, 'agent_sales_qty', e.target.value)}
                                    className="w-16 px-1.5 py-0.5 text-right border border-amber-300 rounded bg-amber-50/50 font-bold"
                                  />
                                ) : (
                                  formatNumber(Number(row.agent_sales_qty) || 0)
                                )}
                              </td>

                              {/* Total Sold (Auto) */}
                              <td className="text-right font-bold text-primary-700">
                                {formatNumber(row.total_sold_qty)}
                              </td>

                              {/* Expected Revenue */}
                              <td className="text-right font-semibold text-slate-800 whitespace-nowrap">
                                {formatUGX(row.expected_revenue)}
                              </td>

                              {/* Amount Received */}
                              <td className="text-right whitespace-nowrap">
                                {isEditingReport ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.amount_received}
                                    onChange={e => handleRowChange(idx, 'amount_received', e.target.value)}
                                    className="w-24 px-1.5 py-0.5 text-right border border-emerald-400 rounded bg-emerald-50/50 font-bold"
                                  />
                                ) : (
                                  <span className="font-bold text-emerald-700">{formatUGX(row.amount_received)}</span>
                                )}
                              </td>

                              {/* Variance */}
                              <td className={`text-right font-bold whitespace-nowrap ${varianceClass(row.variance)}`}>
                                {formatUGX(row.variance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        {/* Totals Footer */}
                        {totals && (
                          <tfoot>
                            <tr className="bg-primary-50 font-extrabold text-slate-900 border-t-2 border-primary-300">
                              <td>TOTAL</td>
                              <td>—</td>
                              <td className="text-right">{formatNumber(totals.direct_sales_qty)}</td>
                              <td className="text-right">{formatNumber(totals.agent_sales_qty)}</td>
                              <td className="text-right text-primary-800">{formatNumber(totals.total_sold_qty)}</td>
                              <td className="text-right">{formatUGX(totals.expected_revenue)}</td>
                              <td className="text-right text-emerald-800">{formatUGX(totals.amount_received)}</td>
                              <td className={`text-right ${varianceClass(totals.variance)}`}>{formatUGX(totals.variance)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Financial Summary Stat Cards */}
                    {totals && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                          <div className="text-[11px] text-text-secondary font-bold uppercase tracking-wider mb-0.5">Expected Money</div>
                          <div className="text-lg font-black text-slate-900">{formatUGX(totals.expected_revenue)}</div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
                          <div className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider mb-0.5">Money Received</div>
                          <div className="text-lg font-black text-emerald-700">{formatUGX(totals.amount_received)}</div>
                        </div>

                        <div className={`rounded-xl p-3.5 text-center border ${totals.variance >= 0 ? 'bg-primary-50 border-primary-200' : 'bg-red-50 border-red-200'}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${totals.variance >= 0 ? 'text-primary-700' : 'text-danger'}`}>
                            Cash Difference
                          </div>
                          <div className={`text-lg font-black ${varianceClass(totals.variance)}`}>
                            {formatUGX(totals.variance)}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10 text-text-secondary">
                    No transaction data found for this period.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="modal-footer flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handlePrint} className="btn-ghost btn-sm text-xs flex items-center gap-1.5">
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button onClick={() => handleDownloadCSV()} className="btn-secondary btn-sm text-xs flex items-center gap-1.5">
                  <Download size={14} className="text-emerald-700" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                  className="btn-secondary btn-sm text-xs flex items-center gap-1.5 font-bold"
                >
                  <Download size={14} className="text-primary-700" />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-secondary btn-sm font-bold text-xs flex items-center gap-1.5"
                >
                  <Check size={14} className="text-primary-600" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button onClick={() => setPreviewOpen(false)} className="btn-primary btn-sm font-bold text-xs">
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
