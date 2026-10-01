import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import { formatUGX, formatNumber, formatDateShort, todayStr, varianceClass } from '../../utils/formatting'
import { History, AlertCircle, Edit2, Trash2, CheckCircle } from 'lucide-react'
import { format, subDays } from 'date-fns'
import Modal from '../../components/Modal/Modal'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'direct', label: 'Direct Sales' },
  { value: 'agent', label: 'Agent Sales' },
  { value: 'distribution', label: 'Distributions' },
]

export default function SalesHistory() {
  const { user } = useAuth()
  const [packages, setPackages] = useState([])
  const [agents, setAgents] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [filters, setFilters] = useState({
    dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    dateTo: todayStr(),
    packageId: '',
    agentId: '',
    type: '',
  })

  // Management modals
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, type }
  const [editTarget, setEditTarget] = useState(null)     // record
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pkgs, agts] = await Promise.all([
        salesService.getPackages(),
        salesService.getAgents(user.id),
      ])
      setPackages(pkgs || [])
      setAgents(agts || [])

      const f = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        packageId: filters.packageId || undefined,
        agentId: filters.agentId || undefined,
      }

      const results = []

      if (!filters.type || filters.type === 'direct') {
        const ds = await salesService.getDirectSales(user.id, f)
        results.push(...(ds || []).map(r => ({
          ...r,
          _type: 'direct',
          date: r.sales_date,
          agentName: null,
          qty: r.quantity ?? r.quantity_sold ?? 0,
          expected: (r.quantity ?? r.quantity_sold ?? 0) * (r.voucher_packages?.face_value || 0),
          received: r.amount_received,
          variances: Number(r.amount_received || 0) - ((r.quantity ?? r.quantity_sold ?? 0) * (r.voucher_packages?.face_value || 0)),
        })))
      }

      if (!filters.type || filters.type === 'agent') {
        const ags = await salesService.getAgentSales(user.id, f)
        results.push(...(ags || []).map(r => {
          const given = Number(r.initial_vouchers_given ?? r.quantity ?? r.quantity_sold ?? 0)
          const fVal = Number(r.voucher_packages?.face_value || 0)
          const comm = Number(r.commission_amount || 0)
          const exp = Math.max(0, (given * fVal) - comm)
          const rec = Number(r.amount_received || 0)
          return {
            ...r,
            _type: 'agent',
            date: r.sales_date,
            agentName: r.agents?.full_name,
            qty: r.quantity ?? r.quantity_sold ?? 0,
            expected: exp,
            received: r.amount_received,
            variances: rec - exp,
          }
        }))
      }

      if (!filters.type || filters.type === 'distribution') {
        const dists = await salesService.getDistributions(user.id, f)
        results.push(...(dists || []).map(r => ({
          ...r,
          _type: 'distribution',
          date: r.dist_date,
          agentName: r.agents?.full_name,
          qty: r.quantity,
          expected: r.quantity * (r.voucher_packages?.face_value || 0),
          received: null,
          variances: null,
        })))
      }

      // Sort by date desc
      results.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))
      setRecords(results)
    } catch (e) {
      setError('Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [user, filters])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh(['direct_sales', 'agent_sales', 'voucher_distributions', 'daily_voucher_balances', 'agents'], loadData, !!user)

  // Edit actions
  const openEditModal = (r) => {
    setEditTarget(r)
    if (r._type === 'direct') {
      setEditForm({
        quantity: String(r.quantity ?? r.quantity_sold ?? 0),
        amount_received: String(r.amount_received ?? 0),
        notes: r.notes || '',
      })
    } else if (r._type === 'agent') {
      setEditForm({
        initial_vouchers_given: String(r.initial_vouchers_given ?? r.quantity ?? 0),
        quantity_sold: String(r.quantity ?? r.quantity_sold ?? 0),
        amount_received: String(r.amount_received ?? 0),
        commission_amount: String(r.commission_amount ?? 0),
        notes: r.notes || r.remarks || '',
      })
    } else if (r._type === 'distribution') {
      setEditForm({
        quantity: String(r.quantity ?? 0),
        notes: r.notes || '',
      })
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setError('')
    try {
      if (editTarget._type === 'direct') {
        await salesService.updateDirectSale(editTarget.id, {
          quantity: parseInt(editForm.quantity) || 0,
          amount_received: parseFloat(editForm.amount_received) || 0,
          notes: editForm.notes,
        })
      } else if (editTarget._type === 'agent') {
        const given = parseInt(editForm.initial_vouchers_given) || 0
        const sold = parseInt(editForm.quantity_sold) || 0
        await salesService.updateAgentSale(editTarget.id, {
          initial_vouchers_given: given,
          quantity: sold,
          remaining_balance: Math.max(0, given - sold),
          amount_received: parseFloat(editForm.amount_received) || 0,
          commission_amount: parseFloat(editForm.commission_amount) || 0,
          notes: editForm.notes,
        })
      } else if (editTarget._type === 'distribution') {
        await salesService.updateDistribution(editTarget.id, {
          quantity: parseInt(editForm.quantity) || 0,
          notes: editForm.notes,
        })
      }

      setSuccess('Transaction record updated successfully.')
      setEditTarget(null)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update transaction.')
    } finally {
      setSaving(false)
    }
  }

  // Delete actions
  const handleDeleteRecord = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      if (deleteTarget.type === 'direct') {
        await salesService.deleteDirectSale(deleteTarget.id)
      } else if (deleteTarget.type === 'agent') {
        await salesService.deleteAgentSale(deleteTarget.id)
      } else if (deleteTarget.type === 'distribution') {
        await salesService.deleteDistribution(deleteTarget.id)
      }

      setSuccess('Transaction record deleted.')
      setDeleteTarget(null)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete record.')
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = (t) => {
    if (t === 'direct') return <span className="badge-info">Direct Sale</span>
    if (t === 'agent') return <span className="badge-success">Agent Sale</span>
    return <span className="badge-neutral">Distribution</span>
  }

  const totals = records.reduce((acc, r) => ({
    qty: acc.qty + (r.qty || 0),
    received: acc.received + (Number(r.received) || 0),
  }), { qty: 0, received: 0 })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sales History</h1>
        <p className="page-subtitle">Full transaction history with instant filters &amp; record management</p>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={filters.dateFrom} max={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={filters.dateTo} max={todayStr()} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Package</label>
              <select className="form-select" value={filters.packageId} onChange={e => setFilters(p => ({ ...p, packageId: e.target.value }))}>
                <option value="">All Packages</option>
                {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Agent</label>
              <select className="form-select" value={filters.agentId} onChange={e => setFilters(p => ({ ...p, agentId: e.target.value }))}>
                <option value="">All Agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 mb-4 text-sm text-text-secondary">
        <span><strong className="text-text-primary">{records.length}</strong> records found</span>
        <span>Total Qty: <strong className="text-text-primary">{formatNumber(totals.qty)}</strong></span>
        <span>Total Received: <strong className="text-primary-600">{formatUGX(totals.received)}</strong></span>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading history...</div>
      ) : records.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <History size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary font-medium">No records found for the selected filters</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Agent</th>
                  <th>Package</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Expected (UGX)</th>
                  <th className="text-right">Received (UGX)</th>
                  <th className="text-right">Cash Difference</th>
                  <th>Remarks</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={`${r._type}-${r.id}`}>
                    <td className="text-text-secondary">{formatDateShort(r.date)}</td>
                    <td>{typeLabel(r._type)}</td>
                    <td>{r.agentName || <span className="text-text-secondary">—</span>}</td>
                    <td>{r.voucher_packages?.name || 'Package'}</td>
                    <td className="text-right font-medium">{formatNumber(r.qty)}</td>
                    <td className="text-right">{formatUGX(r.expected)}</td>
                    <td className="text-right">{r.received !== null ? formatUGX(r.received) : <span className="text-text-secondary">—</span>}</td>
                    <td className={`text-right font-semibold ${r.variances !== null ? varianceClass(r.variances) : 'text-text-secondary'}`}>
                      {r.variances !== null ? formatUGX(r.variances) : '—'}
                    </td>
                    <td className="text-text-secondary text-sm">{r.remarks || r.notes || '—'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(r)}
                          className="btn-ghost btn-sm p-1.5"
                          title="Edit Transaction"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: r.id, type: r._type })}
                          className="btn-ghost btn-sm p-1.5 text-danger hover:bg-red-50"
                          title="Delete Record"
                        >
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

      {/* Edit Modal */}
      {editTarget && (
        <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${editTarget._type === 'direct' ? 'Direct Sale' : editTarget._type === 'agent' ? 'Agent Sale' : 'Distribution'}`}>
          <form onSubmit={handleSaveEdit}>
            <div className="modal-body space-y-4">
              <div className="text-sm bg-gray-50 p-3 rounded-md font-medium text-text-secondary">
                Package: <strong className="text-text-primary">{editTarget.voucher_packages?.name}</strong> • Date: <strong className="text-text-primary">{formatDateShort(editTarget.date)}</strong>
              </div>

              {editTarget._type === 'direct' && (
                <>
                  <div>
                    <label className="form-label">Quantity Sold</label>
                    <input type="number" min={1} className="form-input" value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="form-label">Amount Received (UGX)</label>
                    <input type="number" min={0} step="0.01" className="form-input" value={editForm.amount_received} onChange={e => setEditForm(p => ({ ...p, amount_received: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </>
              )}

              {editTarget._type === 'agent' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Initial Vouchers Given</label>
                      <input type="number" min={0} className="form-input" value={editForm.initial_vouchers_given} onChange={e => setEditForm(p => ({ ...p, initial_vouchers_given: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="form-label">Vouchers Sold</label>
                      <input type="number" min={0} className="form-input" value={editForm.quantity_sold} onChange={e => setEditForm(p => ({ ...p, quantity_sold: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Money Collected (UGX)</label>
                      <input type="number" min={0} step="0.01" className="form-input" value={editForm.amount_received} onChange={e => setEditForm(p => ({ ...p, amount_received: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="form-label">Commission (UGX)</label>
                      <input type="number" min={0} step="0.01" className="form-input" value={editForm.commission_amount} onChange={e => setEditForm(p => ({ ...p, commission_amount: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Notes / Remarks</label>
                    <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </>
              )}

              {editTarget._type === 'distribution' && (
                <>
                  <div>
                    <label className="form-label">Quantity Distributed</label>
                    <input type="number" min={1} className="form-input" value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Record">
          <div className="modal-body">
            <p className="text-text-secondary">Are you sure you want to delete this {deleteTarget.type === 'direct' ? 'direct sale' : deleteTarget.type === 'agent' ? 'agent sale' : 'distribution'} record? This action cannot be undone.</p>
          </div>
          <div className="modal-footer">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDeleteRecord} disabled={saving} className="btn-danger">{saving ? 'Deleting...' : 'Delete Record'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
