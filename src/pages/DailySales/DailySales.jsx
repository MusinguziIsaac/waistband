import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import Modal from '../../components/Modal/Modal'
import { formatUGX, formatNumber, formatDate, todayStr, yesterdayStr } from '../../utils/formatting'
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, Package, ShieldCheck, Zap } from 'lucide-react'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

// Canonical package tier names
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

export default function DailySales() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || todayStr()

  const [packages, setPackages] = useState(DEFAULT_PACKAGES)
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterDate, setFilterDate] = useState(initialDate)

  useEffect(() => {
    const qDate = searchParams.get('date')
    if (qDate) {
      setFilterDate(qDate)
    }
  }, [searchParams])

  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form, setForm] = useState({ package_id: '', sales_date: initialDate, initial_qty: '', additional_qty: '0' })
  const [bulkForm, setBulkForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pkgs, bals] = await Promise.all([
        salesService.getPackages(),
        salesService.getDailyBalance(user.id, filterDate),
      ])
      if (pkgs && pkgs.length > 0) {
        setPackages(dedupePackages(pkgs))
      } else {
        setPackages(DEFAULT_PACKAGES)
      }
      setBalances(bals || [])
    } catch (e) {
      setError('Failed to load daily voucher stock.')
      setPackages(DEFAULT_PACKAGES)
    } finally {
      setLoading(false)
    }
  }, [user, filterDate])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh('daily_voucher_balances', loadData, !!user)

  const openAdd = () => {
    const defaultPkgId = packages[0]?.id || DEFAULT_PACKAGES[0].id
    const existing = balances.find(b => b.package_id === defaultPkgId)
    setEditRecord(null)
    setForm({
      package_id: defaultPkgId,
      sales_date: filterDate,
      initial_qty: existing ? String(existing.initial_qty) : '',
      additional_qty: existing ? String(existing.additional_qty) : '0'
    })
    setModalOpen(true)
  }

  const openBulkAdd = () => {
    const initialBulk = {}
    packages.forEach(pkg => {
      const existing = balances.find(b => b.package_id === pkg.id)
      initialBulk[pkg.id] = {
        initial_qty: existing ? String(existing.initial_qty) : '',
        additional_qty: existing ? String(existing.additional_qty) : '0'
      }
    })
    setBulkForm(initialBulk)
    setBulkModalOpen(true)
  }

  const openEdit = (bal) => {
    setEditRecord(bal)
    setForm({
      package_id: bal.package_id,
      sales_date: bal.sales_date,
      initial_qty: String(bal.initial_qty),
      additional_qty: String(bal.additional_qty),
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        package_id: form.package_id,
        sales_date: form.sales_date,
        initial_qty: parseInt(form.initial_qty) || 0,
        additional_qty: parseInt(form.additional_qty) || 0,
      }
      await salesService.upsertDailyBalance(user.id, payload)
      setSuccess('Daily stock saved successfully.')
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save stock.')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      for (const pkg of packages) {
        const item = bulkForm[pkg.id]
        if (item && (item.initial_qty !== '' || item.additional_qty !== '0')) {
          const payload = {
            package_id: pkg.id,
            sales_date: filterDate,
            initial_qty: parseInt(item.initial_qty) || 0,
            additional_qty: parseInt(item.additional_qty) || 0,
          }
          await salesService.upsertDailyBalance(user.id, payload)
        }
      }
      setSuccess('All package initial stock saved successfully.')
      setBulkModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save bulk stock.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await salesService.deleteDailyBalance(deleteId)
      setDeleteId(null)
      await loadData()
      setSuccess('Stock record deleted.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to delete.')
    }
  }

  const isCarriedForward = balances.some(b => b.is_carried_forward)

  const handleConfirmCarriedForward = async () => {
    setSaving(true)
    setError('')
    try {
      for (const b of balances) {
        if (b.initial_qty > 0 || b.additional_qty > 0) {
          await salesService.upsertDailyBalance(user.id, {
            package_id: b.package_id,
            sales_date: filterDate,
            initial_qty: b.initial_qty,
            additional_qty: b.additional_qty || 0,
          })
        }
      }
      setSuccess("Today's stock confirmed and saved successfully!")
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || "Failed to confirm today's stock.")
    } finally {
      setSaving(false)
    }
  }

  const totalBossStock = balances.reduce((acc, b) => acc + (b.initial_qty || 0), 0)
  const totalAdditionalStock = balances.reduce((acc, b) => acc + (b.additional_qty || 0), 0)
  const totalAvailable = totalBossStock + totalAdditionalStock

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Daily Stock</h1>
          <p className="page-subtitle">Record and manage initial voucher quantities received from your boss / management</p>
        </div>
        <div className="flex items-center gap-2">
          {isCarriedForward && (
            <button
              onClick={handleConfirmCarriedForward}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm"
            >
              <ShieldCheck size={16} /> {saving ? 'Saving...' : "Confirm Today's Stock"}
            </button>
          )}
          <button onClick={openBulkAdd} className="btn-secondary">
            <Zap size={16} className="text-amber-500" /> Enter All Packages
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Add Package Stock
          </button>
        </div>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Carried Forward Stock Reminder Alert */}
      {isCarriedForward && (
        <div className="bg-white border border-border rounded-xl p-4 sm:p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl shrink-0 mt-0.5">
                <Package size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <span>Stock Carried Forward from Previous Day</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">Active in Hand</span>
                </h3>
                <p className="text-text-secondary text-xs sm:text-sm mt-1">
                  You have <strong className="text-slate-900">{formatNumber(totalAvailable)} unsold vouchers</strong> brought forward from your previous stock. These are ready for today's distributions and sales.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleConfirmCarriedForward}
                disabled={saving}
                className="btn-primary btn-sm"
              >
                <ShieldCheck size={14} /> {saving ? 'Saving...' : "Lock In as Today's Stock"}
              </button>
              <button
                onClick={openBulkAdd}
                className="btn-secondary btn-sm"
              >
                <Plus size={14} /> Add Extra Daily Stock
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="card-body py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="form-label mb-0">Select Date:</label>
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
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="text-text-secondary">Initial Stock: <strong className="text-primary">{formatNumber(totalBossStock)}</strong></span>
              <span className="text-text-secondary">Extra Stock: <strong className="text-amber-600">{formatNumber(totalAdditionalStock)}</strong></span>
              <span className="text-text-secondary">Total Available: <strong className="text-slate-900">{formatNumber(totalAvailable)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading voucher stock records...</div>
      ) : balances.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Package size={44} className="mx-auto text-emerald-500 mb-3" />
            <p className="text-text-primary text-base font-bold">No initial stock recorded for {formatDate(filterDate)}</p>
            <p className="text-text-secondary text-sm mt-1 max-w-md mx-auto">
              Enter the initial voucher stock received from your boss today so you can distribute to agents or sell directly.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button onClick={openBulkAdd} className="btn-primary">
                <Zap size={16} /> Enter Initial Daily Stock
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              Stock Available — {formatDate(filterDate)}
              {isCarriedForward && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">
                  Carried Forward
                </span>
              )}
            </h3>
            <span className="text-sm text-text-secondary">Total Stock: <strong className="text-primary-600">{formatNumber(totalAvailable)} vouchers</strong></span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Package Tier</th>
                  <th>Face Value (UGX)</th>
                  <th className="text-right">Initial Daily Stock</th>
                  <th className="text-right">Extra Stock Added</th>
                  <th className="text-right">Total Available Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {balances.map(b => {
                  const pkg = b.voucher_packages || packages.find(p => p.id === b.package_id)
                  return (
                    <tr key={b.id}>
                      <td className="font-bold text-slate-900">{pkg ? fmtPkg(pkg) : '—'}</td>
                      <td>{formatUGX(pkg?.face_value)}</td>
                      <td className="text-right font-bold text-primary-700">{formatNumber(b.initial_qty)}</td>
                      <td className="text-right text-text-secondary">{formatNumber(b.additional_qty)}</td>
                      <td className="text-right font-extrabold text-slate-900">{formatNumber(b.initial_qty + b.additional_qty)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(b)} className="btn-ghost btn-sm p-1.5" title="Edit Stock"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteId(b.id)} className="btn-ghost btn-sm p-1.5 text-danger hover:bg-red-50" title="Delete Stock Record"><Trash2 size={14} /></button>
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

      {/* Single Package Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Stock Received' : 'Enter Initial Daily Stock'}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}
            <div>
              <label className="form-label font-medium">Voucher Package Tier</label>
              <select
                className="form-select"
                value={form.package_id}
                onChange={e => {
                  const pkgId = e.target.value
                  const existing = balances.find(b => b.package_id === pkgId)
                  setForm(p => ({
                    ...p,
                    package_id: pkgId,
                    initial_qty: existing ? String(existing.initial_qty) : p.initial_qty,
                    additional_qty: existing ? String(existing.additional_qty) : p.additional_qty
                  }))
                }}
                required
                disabled={!!editRecord}
              >
                <option value="">Select package tier...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {fmtPkg(pkg)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label font-medium">Date Received</label>
              <input type="date" className="form-input" value={form.sales_date} max={todayStr()} onChange={e => setForm(p => ({ ...p, sales_date: e.target.value }))} required disabled={!!editRecord} />
            </div>
            <div>
              <label className="form-label font-bold text-slate-900">Initial Daily Stock</label>
              <input 
                type="number" 
                min={0} 
                className="form-input font-bold text-primary-700" 
                placeholder="e.g. 100" 
                value={form.initial_qty} 
                onChange={e => setForm(p => ({ ...p, initial_qty: e.target.value }))} 
                required 
              />
              <p className="text-xs text-text-secondary mt-1">Number of vouchers given to you by the boss at the start of the day.</p>
            </div>
            <div>
              <label className="form-label font-medium">Additional / Top-up Stock (optional)</label>
              <input type="number" min={0} className="form-input" placeholder="0" value={form.additional_qty} onChange={e => setForm(p => ({ ...p, additional_qty: e.target.value }))} />
              <p className="text-xs text-text-secondary mt-1">Extra stock given to you later during the day.</p>
            </div>
            <div className="bg-primary-50 rounded-lg px-4 py-3 text-sm flex items-center justify-between border border-primary-100">
              <span className="text-primary-800 font-medium">Total Available Stock:</span>
              <span className="font-extrabold text-primary-900 text-base">{formatNumber((parseInt(form.initial_qty) || 0) + (parseInt(form.additional_qty) || 0))} vouchers</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Stock Record'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Stock Entry Modal for All Packages */}
      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title={`Enter All Initial Daily Stock (${formatDate(filterDate)})`}>
        <form onSubmit={handleBulkSave}>
          <div className="modal-body space-y-4">
            <p className="text-sm text-text-secondary">
              Enter the quantity of vouchers received from your boss for each package tier below:
            </p>

            {error && <div className="alert-danger"><AlertCircle size={16} />{error}</div>}

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {packages.map(pkg => {
                const item = bulkForm[pkg.id] || { initial_qty: '', additional_qty: '0' }
                return (
                  <div key={pkg.id} className="p-3 bg-gray-50 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{fmtPkg(pkg)}</h4>
                      <p className="text-xs text-emerald-600 font-semibold">Face Value: UGX {Number(pkg.face_value).toLocaleString()}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Initial (Boss)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input w-28 py-1 px-2 text-sm font-bold text-primary-700"
                          placeholder="0"
                          value={item.initial_qty}
                          onChange={e => {
                            const val = e.target.value
                            setBulkForm(prev => ({
                              ...prev,
                              [pkg.id]: { ...(prev[pkg.id] || { additional_qty: '0' }), initial_qty: val }
                            }))
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-text-secondary block mb-1">Extra Added</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input w-24 py-1 px-2 text-sm"
                          placeholder="0"
                          value={item.additional_qty}
                          onChange={e => {
                            const val = e.target.value
                            setBulkForm(prev => ({
                              ...prev,
                              [pkg.id]: { ...(prev[pkg.id] || { initial_qty: '' }), additional_qty: val }
                            }))
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save All Package Stock'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Stock Entry">
        <div className="modal-body"><p className="text-text-secondary">Are you sure you want to delete this stock entry? This will update your total available stock.</p></div>
        <div className="modal-footer">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete Stock Record</button>
        </div>
      </Modal>
    </div>
  )
}
