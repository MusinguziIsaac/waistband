import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import { hostelService } from '../../services/hostelService'
import Modal from '../../components/Modal/Modal'
import { formatUGX, formatNumber, formatDate, todayStr, yesterdayStr, varianceClass } from '../../utils/formatting'
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, TrendingUp, DollarSign, Award, PackageCheck, Building2 } from 'lucide-react'

import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

// Canonical tier name by face value — prevents DB noise like "Economy: 500 UGX" leaking through
const TIER_NAMES = {
  500:   'Economy',
  1000:  'Daily',
  6000:  'Weekly',
  20000: 'Monthly',
  80000: 'Semester',
}

// Default standard packages required if none loaded from db yet
const DEFAULT_PACKAGES = [
  { id: '00000000-0000-4000-a000-000000000500', name: 'Economy',  face_value: 500 },
  { id: '00000000-0000-4000-a000-000000001000', name: 'Daily',    face_value: 1000 },
  { id: '00000000-0000-4000-a000-000000006000', name: 'Weekly',   face_value: 6000 },
  { id: '00000000-0000-4000-a000-000000020000', name: 'Monthly',  face_value: 20000 },
  { id: '00000000-0000-4000-a000-000000080000', name: 'Semester', face_value: 80000 },
]

// Format as "Economy: Ush 500"
const fmtPkg = (pkg) => {
  const tierName = TIER_NAMES[Number(pkg.face_value)] || pkg.name
  return `${tierName}: Ush ${Number(pkg.face_value).toLocaleString()}`
}

// Only these five face values are shown — 5000, 10000, or any others are dropped
const ALLOWED_VALUES = new Set([500, 1000, 6000, 20000, 80000])

// Deduplicate by face_value, filter to allowed tiers, and normalise name
const dedupePackages = (pkgs) => {
  const seen = new Set()
  return pkgs
    .filter(p => {
      const val = Number(p.face_value)
      if (!ALLOWED_VALUES.has(val)) return false  // drop 5000, 10000, etc.
      if (seen.has(val)) return false              // drop duplicates
      seen.add(val)
      return true
    })
    .map(p => ({ ...p, name: TIER_NAMES[Number(p.face_value)] || p.name }))
}

export default function AgentSales() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || todayStr()

  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
  const [agents, setAgents] = useState([])
  const [hostels, setHostels] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterDate, setFilterDate] = useState(initialDate)

  useEffect(() => {
    const qDate = searchParams.get('date')
    if (qDate) setFilterDate(qDate)
  }, [searchParams])

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form, setForm] = useState({
    agent_id: '',
    package_id: '',
    hostel_id: '',
    sales_date: initialDate,
    initial_vouchers_given: '',
    quantity_sold: '',
    amount_received: '',
    commission_amount: '0',
    remarks: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const selectedPackage = packages.find(p => p.id === form.package_id) || DEFAULT_PACKAGES[0]
  const initialGiven = parseInt(form.initial_vouchers_given) || 0
  const qtySold = parseInt(form.quantity_sold) || 0
  const remainingUnsold = Math.max(0, initialGiven - qtySold)

  const grossExpectedAmount = initialGiven * (selectedPackage?.face_value || 0)
  const commissionVal = parseFloat(form.commission_amount) || 0
  const netExpectedAmount = Math.max(0, grossExpectedAmount - commissionVal)
  const amountReceivedVal = parseFloat(form.amount_received) || 0
  const cashVariance = amountReceivedVal - netExpectedAmount

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pkgs, agts, sl, hst] = await Promise.all([
        salesService.getPackages(),
        salesService.getAgents(user.id),
        salesService.getAgentSales(user.id, { date: filterDate }),
        hostelService.getHostels(user.id)
      ])

      // Fallback to standard 5 packages if none returned from db, dedupe by face_value
      if (pkgs && pkgs.length > 0) {
        setPackages(dedupePackages(pkgs))
      } else {
        setPackages(DEFAULT_PACKAGES)
      }

      setAgents(agts || [])
      setSales(sl || [])
      setHostels(hst || [])
    } catch (e) {
      setError('Failed to load agent sales data.')
      setPackages(DEFAULT_PACKAGES)
    } finally {
      setLoading(false)
    }
  }, [user, filterDate])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh(['daily_voucher_balances', 'agent_sales', 'agents'], loadData, !!user)

  const openAdd = () => {
    setEditRecord(null)
    setForm({
      agent_id: agents[0]?.id || '',
      package_id: packages[0]?.id || DEFAULT_PACKAGES[0].id,
      hostel_id: '',
      sales_date: filterDate,
      initial_vouchers_given: '',
      quantity_sold: '',
      amount_received: '',
      commission_amount: '0',
      remarks: ''
    })
    setModalOpen(true)
  }

  const openEdit = (sale) => {
    setEditRecord(sale)
    setForm({
      agent_id: sale.agent_id,
      package_id: sale.package_id,
      hostel_id: sale.hostel_id || '',
      sales_date: sale.sales_date,
      initial_vouchers_given: String(sale.initial_vouchers_given ?? sale.quantity ?? 0),
      quantity_sold: String(sale.quantity ?? sale.quantity_sold ?? 0),
      amount_received: String(sale.amount_received ?? 0),
      commission_amount: String(sale.commission_amount ?? 0),
      remarks: sale.notes || sale.remarks || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (qtySold > initialGiven) {
      setError(`Quantity sold (${formatNumber(qtySold)}) cannot exceed initial vouchers given (${formatNumber(initialGiven)}).`)
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        agent_id: form.agent_id,
        package_id: form.package_id,
        hostel_id: form.hostel_id || null,
        sales_date: form.sales_date,
        initial_vouchers_given: initialGiven,
        quantity: qtySold,
        remaining_balance: remainingUnsold,
        amount_received: amountReceivedVal,
        commission_amount: commissionVal,
        notes: form.remarks,
      }

      if (editRecord) {
        await salesService.updateAgentSale(editRecord.id, payload)
      } else {
        await salesService.createAgentSale(user.id, payload)
      }

      setSuccess('Agent sale record saved successfully.')
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save agent sale.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await salesService.deleteAgentSale(deleteId)
      setDeleteId(null)
      await loadData()
      setSuccess('Agent sale record deleted.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to delete.')
    }
  }

  const totals = sales.reduce((acc, s) => {
    const pkg = packages.find(p => p.id === s.package_id) || s.voucher_packages
    const faceVal = pkg?.face_value || 0
    const given = s.initial_vouchers_given ?? s.quantity ?? 0
    const sold = s.quantity ?? s.quantity_sold ?? 0
    const remaining = s.remaining_balance ?? Math.max(0, given - sold)
    const received = Number(s.amount_received || 0)
    const comm = Number(s.commission_amount || 0)
    const grossExp = given * faceVal
    const netExp = Math.max(0, grossExp - comm)
    const varVal = received - netExp

    return {
      initialGiven: acc.initialGiven + given,
      sold: acc.sold + sold,
      remaining: acc.remaining + remaining,
      expected: acc.expected + netExp,
      commission: acc.commission + comm,
      received: acc.received + received,
      variance: acc.variance + varVal,
    }
  }, { initialGiven: 0, sold: 0, remaining: 0, expected: 0, commission: 0, received: 0, variance: 0 })

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Agent Sales & Commission</h1>
          <p className="page-subtitle">Track initial vouchers given, sales returns, money received, and commissions</p>
        </div>
        <button onClick={openAdd} className="btn-primary" disabled={agents.length === 0}>
          <Plus size={16} /> Record Agent Sale
        </button>
      </div>

      {agents.length === 0 && !loading && (
        <div className="alert-warning mb-4">
          <AlertCircle size={16} />
          <span>No agents found. Please add agents in the <strong>Agents</strong> tab first.</span>
        </div>
      )}
      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      <div className="card mb-6">
        <div className="card-body py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="form-label mb-0">Date:</label>
              <input
                type="date"
                className="form-input max-w-xs"
                value={filterDate}
                max={todayStr()}
                onChange={e => setFilterDate(e.target.value)}
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterDate(yesterdayStr())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filterDate === yesterdayStr()
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDate(todayStr())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filterDate === todayStr()
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  Today
                </button>
              </div>
            </div>
            <div className="text-sm text-text-secondary">
              Package Options: <strong className="text-text-primary">Economy: Ush 500  •  Daily: Ush 1,000  •  Weekly: Ush 6,000  •  Monthly: Ush 20,000  •  Semester: Ush 80,000</strong>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading agent sales...</div>
      ) : sales.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <TrendingUp size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary font-medium">No agent sales recorded for {formatDate(filterDate)}</p>
            <p className="text-text-secondary text-sm mt-1">Click "Record Agent Sale" to enter initial vouchers, sales, money received & commission.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Agent Sales Records — {formatDate(filterDate)}</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Package</th>
                  <th className="text-right">Stock Given</th>
                  <th className="text-right">Sold</th>
                  <th className="text-right">Stock Left</th>
                  <th className="text-right">Expected Money (UGX)</th>
                  <th className="text-right">Money Collected (UGX)</th>
                  <th className="text-right">Commission (UGX)</th>
                  <th className="text-right">Cash Difference</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const pkg = s.voucher_packages || packages.find(p => p.id === s.package_id)
                  const faceVal = pkg?.face_value || 0
                  const given = s.initial_vouchers_given ?? s.quantity ?? 0
                  const sold = s.quantity ?? s.quantity_sold ?? 0
                  const remaining = s.remaining_balance ?? Math.max(0, given - sold)
                  const received = Number(s.amount_received || 0)
                  const comm = Number(s.commission_amount || 0)
                  const grossExp = given * faceVal
                  const netExp = Math.max(0, grossExp - comm)
                  const varVal = received - netExp

                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{s.agents?.full_name || 'Agent'}</td>
                      <td>{pkg ? fmtPkg(pkg) : '—'}</td>
                      <td className="text-right font-medium">{formatNumber(given)}</td>
                      <td className="text-right font-semibold text-primary">{formatNumber(sold)}</td>
                      <td className="text-right text-text-secondary">{formatNumber(remaining)}</td>
                      <td className="text-right font-medium">{formatUGX(netExp)}</td>
                      <td className="text-right font-medium">{formatUGX(received)}</td>
                      <td className="text-right text-amber-600 font-medium">{formatUGX(comm)}</td>
                      <td className={`text-right font-semibold ${varianceClass(varVal)}`}>{formatUGX(varVal)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="btn-ghost btn-sm p-1.5"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(s.id)} className="btn-ghost btn-sm p-1.5 text-danger hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={2}>TOTALS</td>
                  <td className="text-right">{formatNumber(totals.initialGiven)}</td>
                  <td className="text-right text-primary">{formatNumber(totals.sold)}</td>
                  <td className="text-right">{formatNumber(totals.remaining)}</td>
                  <td className="text-right">{formatUGX(totals.expected)}</td>
                  <td className="text-right">{formatUGX(totals.received)}</td>
                  <td className="text-right text-amber-600">{formatUGX(totals.commission)}</td>
                  <td className={`text-right ${varianceClass(totals.variance)}`}>{formatUGX(totals.variance)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Agent Sale & Commission' : 'Record Agent Sale & Commission'}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

            <div>
              <label className="form-label">Select Agent</label>
              <select className="form-select" value={form.agent_id} onChange={e => setForm(p => ({ ...p, agent_id: e.target.value }))} required>
                <option value="">Choose Agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.location || 'No location'})</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Hostel / Rental Location (Optional)</label>
              <select className="form-select" value={form.hostel_id} onChange={e => setForm(p => ({ ...p, hostel_id: e.target.value }))}>
                <option value="">None / General Sale</option>
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.location})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Voucher Package</label>
              <select className="form-select" value={form.package_id} onChange={e => setForm(p => ({ ...p, package_id: e.target.value }))} required>
                <option value="">Select Package...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {fmtPkg(pkg)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Sales Date</label>
              <input type="date" className="form-input" value={form.sales_date} max={todayStr()} onChange={e => setForm(p => ({ ...p, sales_date: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label flex items-center gap-1">
                  <PackageCheck size={16} className="text-primary" />
                  Initial Vouchers Given
                </label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  placeholder="e.g. 50"
                  value={form.initial_vouchers_given}
                  onChange={e => setForm(p => ({ ...p, initial_vouchers_given: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="form-label flex items-center gap-1">
                  <TrendingUp size={16} className="text-primary" />
                  Vouchers Sold
                </label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  placeholder="e.g. 40"
                  value={form.quantity_sold}
                  onChange={e => setForm(p => ({ ...p, quantity_sold: e.target.value }))}
                  required
                />
              </div>
            </div>

            {initialGiven > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
                <span className="text-text-secondary">Unsold Voucher Balance:</span>
                <span className="font-bold text-text-primary">{formatNumber(remainingUnsold)} vouchers remaining</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label flex items-center gap-1">
                  <DollarSign size={16} className="text-emerald-600" />
                  Money Received (UGX)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={form.amount_received}
                  onChange={e => setForm(p => ({ ...p, amount_received: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="form-label flex items-center gap-1">
                  <Award size={16} className="text-amber-500" />
                  Commission Given (UGX)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={form.commission_amount}
                  onChange={e => setForm(p => ({ ...p, commission_amount: e.target.value }))}
                />
              </div>
            </div>

            {qtySold > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Gross Expected (Qty × Face Value):</span>
                  <span className="font-semibold">{formatUGX(grossExpectedAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Less Commission:</span>
                  <span className="text-amber-600 font-semibold">- {formatUGX(commissionVal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Net Expected Money:</span>
                  <span className="font-bold text-text-primary">{formatUGX(netExpectedAmount)}</span>
                </div>
                <div className={`flex items-center justify-between text-sm font-bold p-2.5 rounded-lg ${cashVariance >= 0 ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-danger'}`}>
                  <span>Cash Variance:</span>
                  <span>{formatUGX(cashVariance)} {cashVariance >= 0 ? '✓' : '⚠ Shortage'}</span>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Notes / Remarks (optional)</label>
              <textarea className="form-input" rows={2} placeholder="Add any notes..." value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || qtySold > initialGiven} className="btn-primary">
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Agent Sale Record">
        <div className="modal-body"><p className="text-text-secondary">Delete this agent sale record? This action cannot be undone.</p></div>
        <div className="modal-footer">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete Record</button>
        </div>
      </Modal>
    </div>
  )
}
