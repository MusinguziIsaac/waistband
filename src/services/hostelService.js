import { supabase } from './supabase'
import { salesService } from './salesService'

export const DEFAULT_HOSTELS = [
  {
    name: 'Premercy',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 11,
    residents_count: 22,
    status: 'active',
    notes: ''
  },
  {
    name: 'Mwake Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 11,
    residents_count: 21,
    status: 'active',
    notes: ''
  },
  {
    name: 'Daisy Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 8,
    residents_count: 15,
    status: 'active',
    notes: ''
  },
  {
    name: "Mama Kiwowo's",
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 7,
    residents_count: 13,
    status: 'active',
    notes: ''
  },
  {
    name: 'J.B Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 6,
    residents_count: 12,
    status: 'active',
    notes: ''
  },
  {
    name: 'Bekunda Musa Rentals',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 4,
    residents_count: 7,
    status: 'active',
    notes: ''
  },
  {
    name: 'Welden Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 8,
    residents_count: 15,
    status: 'active',
    notes: ''
  },
  {
    name: 'MM Hostels Besides Welden',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 11,
    residents_count: 21,
    status: 'active',
    notes: 'Located beside Welden Hostels'
  },
  {
    name: 'AB Rentals Opposite J.k Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 5,
    residents_count: 10,
    status: 'active',
    notes: 'Opposite J.K Hostels'
  },
  {
    name: 'Josephs Rentals',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 5,
    residents_count: 9,
    status: 'active',
    notes: ''
  },
  {
    name: "Naume's Rentals",
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 7,
    residents_count: 14,
    status: 'active',
    notes: ''
  },
  {
    name: 'Community of care Good Hostels',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 4,
    residents_count: 8,
    status: 'active',
    notes: ''
  },
  {
    name: 'James Rentals',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 5,
    residents_count: 9,
    status: 'active',
    notes: ''
  },
  {
    name: "Janet's Rentals",
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 9,
    residents_count: 18,
    status: 'active',
    notes: ''
  },
  {
    name: 'Near Mwine Mpaka',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 11,
    residents_count: 22,
    status: 'active',
    notes: 'Near Mwine Mpaka area'
  },
  {
    name: 'Rentals Below Norida',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 4,
    residents_count: 7,
    status: 'active',
    notes: 'Below Norida'
  },
  {
    name: "NK Hostels OPP Mama Kiwowo's",
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 9,
    residents_count: 17,
    status: 'active',
    notes: "Opposite Mama Kiwowo's"
  },
  {
    name: 'BB Hostels (Murogoti)',
    location: 'Murogoti, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 8,
    residents_count: 15,
    status: 'active',
    notes: 'Murogoti area'
  },
  {
    name: 'Jameson',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 3,
    residents_count: 6,
    status: 'active',
    notes: ''
  },
  {
    name: 'Pandora',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 0,
    residents_count: 0,
    status: 'active',
    notes: ''
  },
  {
    name: 'Below Daisy',
    location: 'Kikoni, Makerere',
    manager_name: '',
    phone: '',
    rooms_count: 4,
    residents_count: 8,
    status: 'active',
    notes: 'Below Daisy Hostels'
  }
]

export const hostelService = {
  async seedDefaultHostels(marketerId) {
    if (!marketerId) return []
    try {
      const inserts = DEFAULT_HOSTELS.map(h => ({
        ...h,
        marketer_id: marketerId
      }))
      const { data, error } = await supabase
        .from('hostels')
        .insert(inserts)
        .select()
      if (error) throw error
      return data || []
    } catch (e) {
      console.error('Failed to seed default hostels:', e)
      return []
    }
  },

  async syncDefaultResidentCounts(marketerId) {
    if (!marketerId) return []
    try {
      const { data: existingHostels } = await supabase
        .from('hostels')
        .select('*')
        .eq('marketer_id', marketerId)

      if (!existingHostels || existingHostels.length === 0) {
        return await this.seedDefaultHostels(marketerId)
      }

      const updatedIds = []
      for (const def of DEFAULT_HOSTELS) {
        const match = existingHostels.find(h => h.name.trim().toLowerCase() === def.name.trim().toLowerCase())
        if (match) {
          const { error } = await supabase
            .from('hostels')
            .update({
              residents_count: def.residents_count,
              rooms_count: def.rooms_count
            })
            .eq('id', match.id)
          if (!error) updatedIds.push(match.id)
        } else {
          const { data } = await supabase
            .from('hostels')
            .insert({ ...def, marketer_id: marketerId })
            .select()
          if (data && data.length > 0) updatedIds.push(data[0].id)
        }
      }
      return updatedIds
    } catch (e) {
      console.error('Failed to sync default resident counts:', e)
      throw e
    }
  },

  async getHostels(marketerId, options = {}) {
    if (!marketerId) return []
    const { data, error } = await supabase
      .from('hostels')
      .select('*')
      .eq('marketer_id', marketerId)
      .order('name', { ascending: true })
    if (error) throw error
    
    if ((!data || data.length === 0) && options.autoSeed !== false) {
      const seeded = await this.seedDefaultHostels(marketerId)
      if (seeded && seeded.length > 0) return seeded
    }
    return data || []
  },

  async createHostel(marketerId, payload) {
    const { data, error } = await supabase
      .from('hostels')
      .insert({
        marketer_id: marketerId,
        name: payload.name,
        location: payload.location,
        manager_name: payload.manager_name || null,
        phone: payload.phone || null,
        rooms_count: parseInt(payload.rooms_count) || 0,
        residents_count: parseInt(payload.residents_count) || 0,
        status: payload.status || 'active',
        notes: payload.notes || null
      })
      .select()
    if (error) throw error
    return data[0]
  },

  async updateHostel(hostelId, updates) {
    const payload = { ...updates }
    if (payload.rooms_count !== undefined) payload.rooms_count = parseInt(payload.rooms_count) || 0
    if (payload.residents_count !== undefined) payload.residents_count = parseInt(payload.residents_count) || 0
    const { error } = await supabase
      .from('hostels')
      .update(payload)
      .eq('id', hostelId)
    if (error) throw error
  },

  async deleteHostel(hostelId) {
    const { error } = await supabase
      .from('hostels')
      .delete()
      .eq('id', hostelId)
    if (error) throw error
  },

  async getHostelSalesReport(marketerId, options = {}) {
    const { hostelId, dateFrom, dateTo } = options

    const [hostels, packages, directSales, agentSales] = await Promise.all([
      this.getHostels(marketerId),
      salesService.getPackages(),
      salesService.getDirectSales(marketerId, { dateFrom, dateTo }),
      salesService.getAgentSales(marketerId, { dateFrom, dateTo })
    ])

    const pkgMap = {}
    ;(packages || []).forEach(p => {
      pkgMap[p.id] = Number(p.face_value)
    })

    const FALLBACK_FACE_VALUES = {
      'pkg-economy': 500,
      'pkg-daily': 1000,
      'pkg-weekly': 6000,
      'pkg-monthly': 20000,
      'pkg-semester': 80000,
    }

    const getFaceVal = (record) => {
      if (record.voucher_packages?.face_value) return Number(record.voucher_packages.face_value)
      if (record.face_value) return Number(record.face_value)
      if (record.package_id && pkgMap[record.package_id]) return pkgMap[record.package_id]
      if (record.package_id && FALLBACK_FACE_VALUES[record.package_id]) return FALLBACK_FACE_VALUES[record.package_id]
      return 0
    }

    let targetHostels = hostels || []
    if (hostelId && hostelId !== 'all') {
      targetHostels = targetHostels.filter(h => h.id === hostelId)
    }

    const report = []

    targetHostels.forEach(hostel => {
      const hId = hostel.id
      const hDirects = (directSales || []).filter(d => d.hostel_id === hId)

      if (hDirects.length === 0) {
        report.push({
          hostel_id: hId,
          hostel_name: hostel.name,
          location: hostel.location,
          residents_count: hostel.residents_count || 0,
          package_name: '—',
          direct_sold_qty: 0,
          total_sold_qty: 0,
          expected_revenue: 0,
          amount_received: 0,
          variance: 0,
        })
      } else {
        const pkgGroups = {}
        hDirects.forEach(d => {
          const pid = d.package_id || 'unknown'
          if (!pkgGroups[pid]) pkgGroups[pid] = []
          pkgGroups[pid].push(d)
        })

        Object.keys(pkgGroups).forEach(pid => {
          const sales = pkgGroups[pid]
          const directQty = sales.reduce((sum, d) => sum + Number(d.quantity ?? d.quantity_sold ?? 0), 0)
          const directExpected = sales.reduce((sum, d) => {
            const qty = Number(d.quantity ?? d.quantity_sold ?? 0)
            return sum + (qty * getFaceVal(d))
          }, 0)
          const directReceived = sales.reduce((sum, d) => sum + Number(d.amount_received || 0), 0)

          let pName = 'Unknown'
          if (sales[0].voucher_packages?.name) {
             pName = sales[0].voucher_packages.name
          } else if (pid !== 'unknown') {
             const found = (packages || []).find(p => p.id === pid)
             if (found) pName = found.name
          }

          report.push({
            hostel_id: hId,
            hostel_name: hostel.name,
            location: hostel.location,
            residents_count: hostel.residents_count || 0,
            package_name: pName,
            direct_sales_qty: directQty,
            direct_sold_qty: directQty,
            total_sold_qty: directQty,
            expected_revenue: directExpected,
            amount_received: directReceived,
            variance: directReceived - directExpected,
          })
        })
      }
    })

    // Also collect unassigned sales (where hostel_id is null/not set)
    const unassignedDirects = (directSales || []).filter(d => !d.hostel_id)

    if ((unassignedDirects.length > 0) && (!hostelId || hostelId === 'all')) {
      const pkgGroups = {}
      unassignedDirects.forEach(d => {
        const pid = d.package_id || 'unknown'
        if (!pkgGroups[pid]) pkgGroups[pid] = []
        pkgGroups[pid].push(d)
      })

      Object.keys(pkgGroups).forEach(pid => {
        const sales = pkgGroups[pid]
        const uDirectQty = sales.reduce((sum, d) => sum + Number(d.quantity ?? d.quantity_sold ?? 0), 0)
        const uDirectExp = sales.reduce((sum, d) => sum + (Number(d.quantity ?? d.quantity_sold ?? 0) * getFaceVal(d)), 0)
        const uDirectRec = sales.reduce((sum, d) => sum + Number(d.amount_received || 0), 0)

        let pName = 'Unknown'
        if (sales[0].voucher_packages?.name) {
           pName = sales[0].voucher_packages.name
        } else if (pid !== 'unknown') {
           const found = (packages || []).find(p => p.id === pid)
           if (found) pName = found.name
        }

        report.push({
          hostel_id: 'unassigned',
          hostel_name: 'General / Unassigned Sales',
          location: 'Various',
          residents_count: 0,
          package_name: pName,
          direct_sales_qty: uDirectQty,
          direct_sold_qty: uDirectQty,
          total_sold_qty: uDirectQty,
          expected_revenue: uDirectExp,
          amount_received: uDirectRec,
          variance: uDirectRec - uDirectExp,
        })
      })
    }

    return report
  }
}
