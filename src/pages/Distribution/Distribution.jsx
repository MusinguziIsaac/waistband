import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import Modal from '../../components/Modal/Modal'
import { formatUGX, formatNumber, formatDate, todayStr } from '../../utils/formatting'
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, Share2, Package, Users, ArrowRight, Search, ShieldAlert } from 'lucide-react'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

// Canonical tier name by face value
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

const ALLOWED_VALUES = new Set([500, 1000, 6000, 20000, 80000])

const fmtPkg = (pkg) => {
  const tierName = TIER_NAMES[Number(pkg.face_value)] || pkg.name
  return `${tierName}: Ush ${Number(pkg.face_value).toLocaleString()}`
}

const dedupePackages = (pkgs) => {
  const seen = new Set()
  return pkgs
    .filter(p => {
      const val = Number(p.face_value)
      if (!ALLOWED_VALUES.has(val)) return false
      if (seen.has(val)) return false
      seen.add(val)
      return true
    })
    .map(p => ({ ...p, name: TIER_NAMES[Number(p.face_value)] || p.name }))
}

export default function Distribution() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || todayStr()

  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
  const [agents, setAgents] = useState([])
  const [distributions, setDistributions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterDate, setFilterDate] = useState(initialDate)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const qDate = searchParams.get('date')
    if (qDate) {
      setFilterDate(qDate)
    }
  }, [searchParams])

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form, setForm] = useState({ agent_id: '', package_id: '', dist_date: initialDate, quantity: '', notes: '' })
  const [availableStock, setAvailableStock] = useState(null)
  const [checkingStock, setCheckingStock] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const selectedPackage = packages.find(p => p.id === form.package_id) || DEFAULT_PACKAGES[0]
  const distQty = parseInt(form.quantity) || 0
  const totalValue = distQty * (selectedPackage?.face_value || 0)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pkgs, agts, dists] = await Promise.all([
        salesService.getPackages(),
        salesService.getAgents(user.id),
        salesService.getDistributions(user.id, { date: filterDate }),
      ])
      
      if (pkgs && pkgs.length > 0) {
        setPackages(dedupePackages(pkgs))
      } else {
        setPackages(DEFAULT_PACKAGES)
      }

      setAgents(agts || [])
      setDistributions(dists || [])
    } catch (e) {
      setError('Failed to load distribution data.')
      setPackages(DEFAULT_PACKAGES)
    } finally {
      setLoading(false)
    }
  }, [user, filterDate])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh(['daily_voucher_balances', 'voucher_distributions', 'agents'], loadData, !!user)

  // Check available stock balance for selected package & date
  useEffect(() => {
    if (!form.package_id || !user) {
      setAvailableStock(null)
      return
    }
    let isMounted = true
    setCheckingStock(true)
    salesService.getMarketerBalance(user.id, form.package_id, form.dist_date)
      .then(bal => {
        if (isMounted) setAvailableStock(bal)
      })
      .catch(() => { if (isMounted) setAvailableStock(null) })
      .finally(() => { if (isMounted) setCheckingStock(false) })
    return () => { isMounted = false }
  }, [form.package_id, form.dist_date, user, editRecord, modalOpen])

  const openAdd = () => {
    setEditRecord(null)
    setForm({
      agent_id: agents[0]?.id || '',
      package_id: packages[0]?.id || DEFAULT_PACKAGES[0].id,
      dist_date: filterDate,
      quantity: '',
      notes: ''
    })
    setModalOpen(true)
  }

  const openEdit = (dist) => {
    setEditRecord(dist)
    setForm({
      agent_id: dist.agent_id,
      package_id: dist.package_id,
      dist_date: dist.dist_date,
      quantity: String(dist.quantity),
      notes: dist.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const qty = parseInt(form.quantity) || 0
    if (qty <= 0) {
      setError('Please enter a valid distribution quantity.')
      return
    }
    if (!editRecord && availableStock !== null && qty > availableStock) {
      setError(`Distribution quantity (${formatNumber(qty)}) exceeds available stock balance (${formatNumber(availableStock)} vouchers).`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        agent_id: form.agent_id,
        package_id: form.package_id,
        dist_date: form.dist_date,
        quantity: qty,
        notes: form.notes,
      }
      if (editRecord) {
        await salesService.updateDistribution(editRecord.id, payload)
      } else {
        await salesService.createDistribution(user.id, payload)
      }
      setSuccess('Vouchers distributed successfully.')
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save distribution.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await salesService.deleteDistribution(deleteId)
      setDeleteId(null)
      await loadData()
      setSuccess('Distribution record deleted.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to delete.')
    }
  }

  const totalDistributedQty = distributions.reduce((acc, d) => acc + (d.quantity || 0), 0)
  const totalDistributedValue = distributions.reduce((acc, d) => {
    const pkg = d.voucher_packages || packages.find(p => p.id === d.package_id)
    return acc + ((d.quantity || 0) * (pkg?.face_value || 0))
  }, 0)

  const filteredDistributions = distributions.filter(d => {
    const agentName = (d.agents?.full_name || '').toLowerCase()
    const pkgName = (d.voucher_packages?.name || '').toLowerCase()
    const notes = (d.notes || '').toLowerCase()
    const q = search.toLowerCase()
    return agentName.includes(q) || pkgName.includes(q) || notes.includes(q)
  })

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Voucher Distribution</h1>
          <p className="page-subtitle">Distribute stock vouchers to your sub-agents and monitor active allocations</p>
        </div>
        <button onClick={openAdd} className="btn-primary" disabled={agents.length === 0}>
          <Plus size={16} /> New Distribution
        </button>
      </div>

      {agents.length === 0 && !loading && (
        <div className="alert-warning mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>No active agents found. Please register sub-agents in the <strong>Agents</strong> tab first.</span>
          </div>
          <Link to="/agents" className="btn-secondary btn-sm">Go to Agents <ArrowRight size={14} /></Link>
        </div>
      )}
      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <Share2 size={24} />
          </div>
          <div>
            <div className="text-xs text-text-secondary font-semibold uppercase">Total Distributed (Today)</div>
            <div className="text-2xl font-bold text-text-primary">{formatNumber(totalDistributedQty)} <span className="text-xs font-normal text-text-secondary">vouchers</span></div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Package size={24} />
          </div>
          <div>
            <div className="text-xs text-text-secondary font-semibold uppercase">Total Stock Value</div>
            <div className="text-2xl font-bold text-emerald-700">{formatUGX(totalDistributedValue)}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs text-text-secondary font-semibold uppercase">Active Agents</div>
            <div className="text-2xl font-bold text-text-primary">{agents.length} <span className="text-xs font-normal text-text-secondary">agents</span></div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-6">
        <div className="card-body py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="form-label mb-0">Date:</label>
              <input
                type="date"
                className="form-input max-w-xs"
                value={filterDate}
                max={todayStr()}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Search agent or package..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading distribution records...</div>
      ) : filteredDistributions.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Share2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary font-medium">
              {distributions.length === 0
                ? `No distributions recorded on ${formatDate(filterDate)}`
                : 'No distributions match your search'}
            </p>
            {distributions.length === 0 && (
              <p className="text-xs text-text-secondary mt-1">Click "New Distribution" to issue vouchers to agents.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Distributions — {formatDate(filterDate)}</h3>
            <span className="text-sm text-text-secondary">Total: <strong className="text-primary-600">{formatNumber(totalDistributedQty)} vouchers</strong></span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Package Tier</th>
                  <th className="text-right">Quantity Given</th>
                  <th className="text-right">Total Value (UGX)</th>
                  <th>Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDistributions.map(d => {
                  const pkg = d.voucher_packages || packages.find(p => p.id === d.package_id)
                  const fVal = pkg?.face_value || 0
                  const valUGX = (d.quantity || 0) * fVal
                  return (
                    <tr key={d.id}>
                      <td className="font-medium text-slate-900">{d.agents?.full_name || 'Sub-Agent'}</td>
                      <td>{pkg ? fmtPkg(pkg) : '—'}</td>
                      <td className="text-right font-bold text-primary">{formatNumber(d.quantity)}</td>
                      <td className="text-right font-semibold text-slate-900">{formatUGX(valUGX)}</td>
                      <td className="text-text-secondary text-sm">{d.notes || '—'}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(d)} className="btn-ghost btn-sm p-1.5" title="Edit Distribution"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(d.id)} className="btn-ghost btn-sm p-1.5 text-danger hover:bg-red-50" title="Delete Record"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New / Edit Distribution Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Voucher Distribution' : 'New Voucher Distribution'}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

            <div>
              <label className="form-label font-medium">Select Agent</label>
              <select className="form-select" value={form.agent_id} onChange={e => setForm(p => ({ ...p, agent_id: e.target.value }))} required>
                <option value="">Choose Agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.location || 'No area'})</option>)}
              </select>
            </div>

            <div>
              <label className="form-label font-medium">Voucher Package Tier</label>
              <select className="form-select" value={form.package_id} onChange={e => setForm(p => ({ ...p, package_id: e.target.value }))} required>
                <option value="">Select package tier...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {fmtPkg(pkg)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label font-medium">Distribution Date</label>
              <input type="date" className="form-input" value={form.dist_date} max={todayStr()} onChange={e => setForm(p => ({ ...p, dist_date: e.target.value }))} required />
            </div>

            {/* Stock Availability Indicator */}
            {form.package_id && (
              checkingStock ? (
                <div className="bg-slate-50 text-slate-600 rounded-lg p-3 text-sm flex items-center gap-2 border border-slate-200">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Checking live database stock balance...</span>
                </div>
              ) : (availableStock?.totalStock || Number(availableStock || 0)) <= 0 ? (
                <div className="bg-amber-50 text-amber-900 rounded-lg p-3.5 text-sm space-y-2.5 border border-amber-200 shadow-sm">
                  <div className="flex items-center justify-between font-bold text-amber-800">
                    <span className="flex items-center gap-1.5"><ShieldAlert size={16} /> Initial Stock Received: 0 vouchers</span>
                    <span>Total Balance: 0</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    No initial stock has been recorded for this package tier on {formatDate(form.dist_date)}. Please enter initial stock from your boss first.
                  </p>
                  <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-amber-700 font-medium">Daily Stock Required</span>
                    <Link
                      to="/daily-sales"
                      onClick={() => setModalOpen(false)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-800 underline"
                    >
                      <Package size={14} /> Record Initial Daily Stock →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/80 rounded-lg p-3.5 text-sm space-y-2 border border-emerald-200/80">
                  <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold border-b border-emerald-200/60 pb-1.5">
                    <span>Initial Boss Stock: <strong>{formatNumber(availableStock.initial || 0)}</strong></span>
                    <span>Extra Stock: <strong>{formatNumber(availableStock.additional || 0)}</strong></span>
                    <span>Total Voucher Stock: <strong>{formatNumber(availableStock.totalStock || availableStock)}</strong></span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-900 pt-0.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CheckCircle size={16} className="text-emerald-600" />
                      Net Available for Distribution:
                    </span>
                    <span className="font-extrabold text-emerald-900 text-base">
                      {formatNumber(availableStock.available ?? Number(availableStock))} vouchers
                    </span>
                  </div>
                </div>
              )
            )}

            <div>
              <label className="form-label font-medium">Quantity to Distribute</label>
              <input
                type="number"
                min={1}
                className="form-input font-bold text-primary-700"
                placeholder="Enter voucher quantity (e.g. 50)"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                required
              />
            </div>

            {distQty > 0 && selectedPackage && (
              <div className="bg-primary-50 rounded-lg p-3 text-sm flex items-center justify-between border border-primary-100">
                <span className="text-primary-800 font-medium">Total Stock Value:</span>
                <span className="font-extrabold text-primary-900 text-base">{formatUGX(totalValue)}</span>
              </div>
            )}

            <div>
              <label className="form-label font-medium">Notes / Remarks (optional)</label>
              <textarea className="form-input" rows={2} placeholder="Optional notes for this distribution..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={saving || (!editRecord && availableStock !== null && (availableStock <= 0 || distQty > availableStock))}
              className="btn-primary"
            >
              {saving ? 'Saving Distribution...' : 'Issue Vouchers'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Distribution Record">
        <div className="modal-body">
          <p className="text-text-secondary">Are you sure you want to delete this distribution record? The vouchers will be returned to your total available stock.</p>
        </div>
        <div className="modal-footer">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete Distribution</button>
        </div>
      </Modal>
    </div>
  )
}
