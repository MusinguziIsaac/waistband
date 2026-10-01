import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import { hostelService } from '../../services/hostelService'
import Modal from '../../components/Modal/Modal'
import { formatUGX, formatNumber, formatDate, todayStr, yesterdayStr, varianceClass } from '../../utils/formatting'
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, ShoppingBag, Package, ShieldAlert, Building2 } from 'lucide-react'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

// Canonical tier names
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

export default function DirectSales() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || todayStr()

  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
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
  const [form, setForm] = useState({ package_id: '', hostel_id: '', sales_date: initialDate, quantity: '', amount_received: '', notes: '' })
  const [availableStock, setAvailableStock] = useState(null)
  const [checkingStock, setCheckingStock] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const selectedPackage = packages.find(p => p.id === form.package_id) || DEFAULT_PACKAGES[0]
  const expectedAmount = (parseInt(form.quantity) || 0) * (selectedPackage?.face_value || 0)
  const variance = (parseFloat(form.amount_received) || 0) - expectedAmount

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pkgs, sl, hst] = await Promise.all([
        salesService.getPackages(),
        salesService.getDirectSales(user.id, { date: filterDate }),
        hostelService.getHostels(user.id),
      ])
      if (pkgs && pkgs.length > 0) {
        setPackages(dedupePackages(pkgs))
      } else {
        setPackages(DEFAULT_PACKAGES)
      }
      setSales(sl || [])
      setHostels(hst || [])
    } catch (e) {
      setError('Failed to load direct sales.')
      setPackages(DEFAULT_PACKAGES)
    } finally {
      setLoading(false)
    }
  }, [user, filterDate])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh(['daily_voucher_balances', 'direct_sales'], loadData, !!user)

  useEffect(() => {
    if (!form.package_id || !user) {
      setAvailableStock(null)
      return
    }
    let isMounted = true
    setCheckingStock(true)
    salesService.getMarketerBalance(user.id, form.package_id, form.sales_date)
      .then(bal => {
        if (isMounted) setAvailableStock(bal)
      })
      .catch(() => { if (isMounted) setAvailableStock(null) })
      .finally(() => { if (isMounted) setCheckingStock(false) })
    return () => { isMounted = false }
  }, [form.package_id, form.sales_date, user, editRecord, modalOpen])

  const openAdd = () => {
    setEditRecord(null)
    setForm({
      package_id: packages[0]?.id || DEFAULT_PACKAGES[0].id,
      hostel_id: '',
      sales_date: filterDate,
      quantity: '',
      amount_received: '',
      notes: ''
    })
    setModalOpen(true)
  }

  const openEdit = (sale) => {
    setEditRecord(sale)
    setForm({
      package_id: sale.package_id,
      hostel_id: sale.hostel_id || '',
      sales_date: sale.sales_date,
      quantity: String(sale.quantity),
      amount_received: String(sale.amount_received),
      notes: sale.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const qty = parseInt(form.quantity) || 0
    if (qty <= 0) {
      setError('Please enter a valid quantity.')
      return
    }
    if (!editRecord && availableStock !== null && qty > availableStock) {
      setError(`Exceeds available stock balance of ${formatNumber(availableStock)} vouchers.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        package_id: form.package_id,
        hostel_id: form.hostel_id || null,
        sales_date: form.sales_date,
        quantity: qty,
        amount_received: parseFloat(form.amount_received) || 0,
        notes: form.notes,
      }
      if (editRecord) {
        await salesService.updateDirectSale(editRecord.id, payload)
      } else {
        await salesService.createDirectSale(user.id, payload)
      }
      setSuccess('Direct sale recorded successfully.')
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save direct sale.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await salesService.deleteDirectSale(deleteId)
      setDeleteId(null)
      await loadData()
      setSuccess('Direct sale deleted.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to delete.')
    }
  }

  const totals = sales.reduce((acc, s) => {
    const pkg = packages.find(p => p.id === s.package_id) || s.voucher_packages
    const exp = s.quantity * (pkg?.face_value || 0)
    const rec = Number(s.amount_received || 0)
    return {
      qty: acc.qty + s.quantity,
      expected: acc.expected + exp,
      received: acc.received + rec,
      variance: acc.variance + (rec - exp),
    }
  }, { qty: 0, expected: 0, received: 0, variance: 0 })

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Direct Sales</h1>
          <p className="page-subtitle">Record voucher sales made directly to customers by you</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Record Direct Sale
        </button>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      <div className="card mb-6">
        <div className="card-body py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="form-label mb-0">Date:</label>
              <input type="date" className="form-input max-w-xs" value={filterDate} max={todayStr()} onChange={e => setFilterDate(e.target.value)} />
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
        <div className="card p-8 text-center text-text-secondary">Loading direct sales...</div>
      ) : sales.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary font-medium">No direct sales on {formatDate(filterDate)}</p>
            <p className="text-xs text-text-secondary mt-1">Click "Record Direct Sale" to record vouchers sold directly.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Direct Sales — {formatDate(filterDate)}</h3>
            <span className="text-sm text-text-secondary">Total Sold: <strong className="text-primary-600">{formatNumber(totals.qty)} vouchers</strong></span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Package Tier</th>
                  <th>Hostel / Location</th>
                  <th className="text-right">Qty Sold</th>
                  <th className="text-right">Expected (UGX)</th>
                  <th className="text-right">Received (UGX)</th>
                  <th className="text-right">Cash Difference</th>
                  <th>Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const pkg = s.voucher_packages || packages.find(p => p.id === s.package_id)
                  const exp = s.quantity * (pkg?.face_value || 0)
                  const rec = Number(s.amount_received || 0)
                  const varVal = rec - exp
                  const hostelName = s.hostels?.name || hostels.find(h => h.id === s.hostel_id)?.name || 'General Sale'
                  return (
                    <tr key={s.id}>
                      <td className="font-medium text-slate-900">{pkg ? fmtPkg(pkg) : '—'}</td>
                      <td className="text-sm text-text-secondary font-medium">{hostelName}</td>
                      <td className="text-right font-bold text-primary">{formatNumber(s.quantity)}</td>
                      <td className="text-right font-medium">{formatUGX(exp)}</td>
                      <td className="text-right font-medium">{formatUGX(rec)}</td>
                      <td className={`text-right font-semibold ${varianceClass(varVal)}`}>{formatUGX(varVal)}</td>
                      <td className="text-text-secondary text-sm">{s.notes || '—'}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="btn-ghost btn-sm p-1.5" title="Edit Direct Sale"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(s.id)} className="btn-ghost btn-sm p-1.5 text-danger hover:bg-red-50" title="Delete Record"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={2}>TOTAL</td>
                  <td className="text-right text-primary">{formatNumber(totals.qty)}</td>
                  <td className="text-right">{formatUGX(totals.expected)}</td>
                  <td className="text-right">{formatUGX(totals.received)}</td>
                  <td className={`text-right ${varianceClass(totals.variance)}`}>{formatUGX(totals.variance)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Direct Sale' : 'Record Direct Sale'}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

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
              <label className="form-label font-medium">Hostel / Rental Location (Optional)</label>
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
              <label className="form-label font-medium">Sales Date</label>
              <input type="date" className="form-input" value={form.sales_date} max={todayStr()} onChange={e => setForm(p => ({ ...p, sales_date: e.target.value }))} required />
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
                    No initial stock has been recorded for this package tier on {formatDate(form.sales_date)}. Please enter initial stock from your boss first.
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
                      Net Available for Sale:
                    </span>
                    <span className="font-extrabold text-emerald-900 text-base">
                      {formatNumber(availableStock.available ?? Number(availableStock))} vouchers
                    </span>
                  </div>
                </div>
              )
            )}

            <div>
              <label className="form-label font-medium">Quantity Sold</label>
              <input type="number" min={1} className="form-input font-bold text-primary-700" placeholder="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} required />
            </div>

            {parseInt(form.quantity) > 0 && selectedPackage && (
              <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm flex items-center justify-between border border-slate-200">
                <span className="text-text-secondary font-medium">Expected Money: </span>
                <span className="font-bold text-slate-900 text-base">{formatUGX(expectedAmount)}</span>
              </div>
            )}

            <div>
              <label className="form-label font-medium">Amount Received (UGX)</label>
              <input type="number" min={0} step="0.01" className="form-input font-bold text-emerald-700" placeholder="0.00" value={form.amount_received} onChange={e => setForm(p => ({ ...p, amount_received: e.target.value }))} required />
            </div>

            {form.amount_received && parseInt(form.quantity) > 0 && (
              <div className={`rounded-lg px-4 py-2.5 text-sm font-bold flex items-center justify-between ${variance >= 0 ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-danger'}`}>
                <span>Cash Difference:</span>
                <span>{formatUGX(variance)} {variance >= 0 ? '✓ Balanced / Extra' : '⚠ Shortage'}</span>
              </div>
            )}

            <div>
              <label className="form-label font-medium">Notes (optional)</label>
              <textarea className="form-input" rows={2} placeholder="Any customer or order notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={saving || (!editRecord && availableStock !== null && (availableStock <= 0 || parseInt(form.quantity) > availableStock))}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Direct Sale'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Direct Sale Record">
        <div className="modal-body"><p className="text-text-secondary">Delete this direct sale record? The vouchers will return to available stock balance.</p></div>
        <div className="modal-footer">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete Sale</button>
        </div>
      </Modal>
    </div>
  )
}
