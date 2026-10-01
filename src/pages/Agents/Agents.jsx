import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { salesService } from '../../services/salesService'
import Modal from '../../components/Modal/Modal'
import { formatDate, formatNumber, todayStr } from '../../utils/formatting'
import { Plus, Edit2, Users, Phone, MapPin, AlertCircle, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react'

import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'

export default function Agents() {
  const { user } = useAuth()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '', location: '', is_active: true })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const data = await salesService.getAgents(user.id)
      setAgents(data || [])
    } catch (e) {
      setError('Failed to load agents.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // Real-time DB subscription
  useRealtimeRefresh('agents', loadData, !!user)

  const openAdd = () => {
    setEditRecord(null)
    setForm({ full_name: '', phone: '', location: '', is_active: true })
    setModalOpen(true)
  }

  const openEdit = (agent) => {
    setEditRecord(agent)
    setForm({ full_name: agent.full_name, phone: agent.phone || '', location: agent.location || '', is_active: agent.is_active })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editRecord) {
        await salesService.updateAgent(editRecord.id, form)
      } else {
        await salesService.createAgent(user.id, form)
      }
      setSuccess(editRecord ? 'Agent updated.' : 'Agent added successfully.')
      setModalOpen(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save agent.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (agent) => {
    try {
      await salesService.updateAgent(agent.id, { is_active: !agent.is_active })
      await loadData()
    } catch (e) {
      setError('Failed to update agent status.')
    }
  }

  const filtered = agents.filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.phone || '').includes(search) ||
    (a.location || '').toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = agents.filter(a => a.is_active).length

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">{activeCount} active agent{activeCount !== 1 ? 's' : ''} under your account</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Agent</button>
      </div>

      {error && <div className="alert-danger mb-4"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert-success mb-4"><CheckCircle size={16} />{success}</div>}

      {/* Search */}
      <div className="card mb-6">
        <div className="card-body py-4">
          <input
            type="text"
            className="form-input max-w-sm"
            placeholder="Search agents by name, phone or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary font-medium">
              {agents.length === 0 ? 'No agents yet. Add your first agent.' : 'No agents match your search.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(agent => (
                  <tr key={agent.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 text-xs font-bold">
                            {agent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{agent.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Phone size={13} />
                        {agent.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <MapPin size={13} />
                        {agent.location || '—'}
                      </div>
                    </td>
                    <td>
                      {agent.is_active
                        ? <span className="badge-success">Active</span>
                        : <span className="badge-neutral">Inactive</span>}
                    </td>
                    <td className="text-text-secondary text-sm">{formatDate(agent.created_at?.split('T')[0])}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(agent)} className="btn-ghost btn-sm p-1.5" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(agent)}
                          className={`btn-ghost btn-sm p-1.5 ${agent.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-primary hover:bg-primary-50'}`}
                          title={agent.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {agent.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Agent' : 'Add New Agent'}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            <div>
              <label className="form-label">Full Name <span className="text-danger">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Sarah Namubiru" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" placeholder="+256 700 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Location / Area</label>
              <input type="text" className="form-input" placeholder="e.g. Kampala Central" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <label className="form-label mb-0">Status:</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm text-text-primary">Active</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editRecord ? 'Update Agent' : 'Add Agent'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
