import { supabase } from './supabase'

// Canonical package names keyed by face value — single source of truth
const PACKAGE_NAMES = {
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

// Only these five face values are valid — anything else (e.g. 5000, 10000) is excluded
const ALLOWED_VALUES = new Set([500, 1000, 6000, 20000, 80000])

function createStockResult(netAvailable, totalInitial, totalAdditional, totalAvailable, totalDist, totalDirect) {
  const avail = Number(netAvailable || 0)
  const obj = {
    available: avail,
    initial: Number(totalInitial || 0),
    additional: Number(totalAdditional || 0),
    totalStock: Number(totalAvailable || 0),
    distributed: Number(totalDist || 0),
    directSold: Number(totalDirect || 0),
    valueOf() { return this.available },
    toString() { return String(this.available) }
  }
  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive) {
    obj[Symbol.toPrimitive] = function(hint) {
      if (hint === 'string') return String(this.available)
      return this.available
    }
  }
  return obj
}

export const salesService = {
  // Packages
  async getPackages() {
    const { data, error } = await supabase.from('voucher_packages').select('*').order('face_value', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return DEFAULT_PACKAGES

    // Keep only the 5 canonical tiers, deduplicate by face_value
    const seen = new Set()
    return data
      .filter(p => {
        const val = Number(p.face_value)
        if (!ALLOWED_VALUES.has(val)) return false
        if (seen.has(val)) return false
        seen.add(val)
        return true
      })
      .map(p => ({
        ...p,
        name: PACKAGE_NAMES[Number(p.face_value)] || p.name
      }))
  },

  // Agents
  async getAgents(marketerId) {
    const { data, error } = await supabase.from('agents').select('*').eq('marketer_id', marketerId).order('full_name')
    if (error) throw error
    return data
  },
  async createAgent(marketerId, agent) {
    const { data, error } = await supabase.from('agents').insert({ ...agent, marketer_id: marketerId }).select()
    if (error) throw error
    return data[0]
  },
  async updateAgent(agentId, updates) {
    const { error } = await supabase.from('agents').update(updates).eq('id', agentId)
    if (error) throw error
  },

  // Balances
  async getCarriedForwardStock(marketerId, targetDate = todayStr()) {
    if (!marketerId) return []

    const pkgs = await this.getPackages()
    const pkgList = pkgs || DEFAULT_PACKAGES

    // Fetch all historical daily balances up to targetDate (exclusive)
    const { data: pastBalances, error: pastErr } = await supabase.from('daily_voucher_balances')
      .select('*, voucher_packages(*)')
      .eq('marketer_id', marketerId)
      .lt('sales_date', targetDate)
      .order('sales_date', { ascending: false })

    if (pastErr || !pastBalances || pastBalances.length === 0) {
      return pkgList.map(p => ({
        package_id: p.id,
        package_name: p.name,
        face_value: Number(p.face_value),
        initial_qty: 0,
        package: p
      }))
    }

    // Find the latest date that has balances recorded
    const latestDate = pastBalances[0].sales_date
    const latestDayBalances = pastBalances.filter(b => b.sales_date === latestDate)

    // Fetch distributions and direct sales recorded on and since latestDate up to targetDate (exclusive)
    const [distsRes, directsRes] = await Promise.all([
      supabase.from('voucher_distributions')
        .select('*, voucher_packages(*)')
        .eq('marketer_id', marketerId)
        .gte('dist_date', latestDate)
        .lt('dist_date', targetDate),
      supabase.from('direct_sales')
        .select('*, voucher_packages(*)')
        .eq('marketer_id', marketerId)
        .gte('sales_date', latestDate)
        .lt('sales_date', targetDate)
    ])

    const dists = distsRes.data || []
    const directs = directsRes.data || []

    return pkgList.map(pkg => {
      const fVal = Number(pkg.face_value)
      const matchesPkg = (item) => {
        if (item.package_id === pkg.id) return true
        const itemVal = Number(item.voucher_packages?.face_value || item.face_value || 0)
        return itemVal === fVal
      }

      const pkgBals = latestDayBalances.filter(matchesPkg)
      const initial = pkgBals.reduce((sum, b) => sum + Number(b.initial_qty ?? b.opening_balance ?? 0), 0)
      const additional = pkgBals.reduce((sum, b) => sum + Number(b.additional_qty ?? b.additional_stock ?? 0), 0)
      const totalAvail = initial + additional

      const pkgDists = dists.filter(matchesPkg)
      const distQty = pkgDists.reduce((sum, d) => sum + Number(d.quantity || 0), 0)

      const pkgDirects = directs.filter(matchesPkg)
      const directQty = pkgDirects.reduce((sum, d) => sum + Number(d.quantity ?? d.quantity_sold ?? 0), 0)

      const remaining = Math.max(0, totalAvail - distQty - directQty)

      return {
        package_id: pkg.id,
        package_name: pkg.name,
        face_value: fVal,
        initial_qty: remaining,
        package: pkg
      }
    })
  },

  async getOverallStockStatus(marketerId, date = todayStr()) {
    if (!marketerId) return { totalStockInHand: 0, totalCarriedForward: 0, breakdown: [], hasRecordedToday: false, isLowStock: false }

    const pkgs = await this.getPackages()
    const pkgList = pkgs || DEFAULT_PACKAGES

    const [todayBals, dists, directs, pastCarried] = await Promise.all([
      supabase.from('daily_voucher_balances')
        .select('*, voucher_packages(*)')
        .eq('marketer_id', marketerId)
        .eq('sales_date', date),
      supabase.from('voucher_distributions')
        .select('*, voucher_packages(*)')
        .eq('marketer_id', marketerId)
        .eq('dist_date', date),
      supabase.from('direct_sales')
        .select('*, voucher_packages(*)')
        .eq('marketer_id', marketerId)
        .eq('sales_date', date),
      this.getCarriedForwardStock(marketerId, date)
    ])

    const hasRecordedToday = !!(todayBals.data && todayBals.data.length > 0)
    const activeBals = hasRecordedToday ? todayBals.data : pastCarried

    const todayDists = dists.data || []
    const todayDirects = directs.data || []

    const breakdown = pkgList.map(pkg => {
      const fVal = Number(pkg.face_value)
      const matchesPkg = (item) => {
        if (item.package_id === pkg.id) return true
        const itemVal = Number(item.voucher_packages?.face_value || item.face_value || 0)
        return itemVal === fVal
      }

      const matchedBals = (activeBals || []).filter(matchesPkg)
      const initQty = matchedBals.reduce((sum, b) => sum + Number(b.initial_qty ?? b.opening_balance ?? 0), 0)
      const addQty = matchedBals.reduce((sum, b) => sum + Number(b.additional_qty ?? b.additional_stock ?? 0), 0)
      const totalAvail = initQty + addQty

      const matchedDists = todayDists.filter(matchesPkg)
      const distQty = matchedDists.reduce((sum, d) => sum + Number(d.quantity || 0), 0)

      const matchedDirects = todayDirects.filter(matchesPkg)
      const directQty = matchedDirects.reduce((sum, d) => sum + Number(d.quantity ?? d.quantity_sold ?? 0), 0)

      const remainingInHand = Math.max(0, totalAvail - distQty - directQty)

      return {
        package_id: pkg.id,
        name: pkg.name,
        face_value: fVal,
        initial_qty: initQty,
        additional_qty: addQty,
        total_available: totalAvail,
        distributed_qty: distQty,
        direct_sales_qty: directQty,
        available: remainingInHand,
        isLow: remainingInHand > 0 && remainingInHand <= 5,
        isOutOfStock: remainingInHand === 0,
      }
    })

    const totalStockInHand = breakdown.reduce((sum, b) => sum + b.available, 0)
    const totalCarriedForward = pastCarried.reduce((sum, c) => sum + (c.initial_qty || 0), 0)

    return {
      totalStockInHand,
      totalCarriedForward,
      hasRecordedToday,
      breakdown,
      isLowStock: breakdown.some(b => b.isLow || b.isOutOfStock)
    }
  },

  async getDailyBalance(marketerId, date = todayStr(), options = { autoCarryForward: true }) {
    if (!marketerId) return []
    const { data, error } = await supabase.from('daily_voucher_balances')
      .select('*, voucher_packages(*)')
      .eq('marketer_id', marketerId)
      .eq('sales_date', date)
    if (error) throw error

    // If explicit balances exist for this date, normalize and return them
    if (data && data.length > 0) {
      return data.map(row => ({
        ...row,
        initial_qty: Number(row.initial_qty ?? row.opening_balance ?? 0),
        additional_qty: Number(row.additional_qty ?? row.additional_stock ?? 0),
        is_carried_forward: false,
      }))
    }

    // Auto-carry forward: If no records for today, automatically carry forward yesterday's closing stock
    if (options && options.autoCarryForward !== false) {
      try {
        const carried = await this.getCarriedForwardStock(marketerId, date)
        if (carried && carried.length > 0 && carried.some(c => c.initial_qty > 0)) {
          return carried.map(c => ({
            id: `carried-${c.package_id}-${date}`,
            marketer_id: marketerId,
            package_id: c.package_id,
            sales_date: date,
            initial_qty: c.initial_qty,
            additional_qty: 0,
            is_carried_forward: true,
            voucher_packages: c.package,
          }))
        }
      } catch (e) {
        console.error('Error auto-carrying forward stock:', e)
      }
    }

    return []
  },

  async upsertDailyBalance(marketerId, payload) {
    const initVal = payload.initial_qty ?? payload.opening_balance ?? 0
    const addVal = payload.additional_qty ?? payload.additional_stock ?? 0

    // Primary payload using standard column names
    const primaryPayload = {
      package_id: payload.package_id,
      sales_date: payload.sales_date,
      initial_qty: initVal,
      additional_qty: addVal,
    }

    // Check if exists
    const { data: existing } = await supabase.from('daily_voucher_balances')
      .select('id')
      .eq('marketer_id', marketerId)
      .eq('sales_date', primaryPayload.sales_date)
      .eq('package_id', primaryPayload.package_id)
      .maybeSingle()

    const performSave = async (dbData) => {
      if (existing) {
        return await supabase.from('daily_voucher_balances').update(dbData).eq('id', existing.id)
      } else {
        return await supabase.from('daily_voucher_balances').insert({ ...dbData, marketer_id: marketerId })
      }
    }

    let { error } = await performSave(primaryPayload)

    // Fallback if PostgREST schema cache does not have initial_qty or additional_qty column
    if (error && error.message && (error.message.includes('Could not find') || error.code === 'PGRST204')) {
      const fallbackPayload1 = {
        package_id: payload.package_id,
        sales_date: payload.sales_date,
        opening_balance: initVal,
        additional_qty: addVal,
      }
      let res1 = await performSave(fallbackPayload1)
      if (!res1.error) return

      const fallbackPayload2 = {
        package_id: payload.package_id,
        sales_date: payload.sales_date,
        initial_qty: initVal,
        additional_stock: addVal,
      }
      let res2 = await performSave(fallbackPayload2)
      if (!res2.error) return

      const fallbackPayload3 = {
        package_id: payload.package_id,
        sales_date: payload.sales_date,
        opening_balance: initVal,
        additional_stock: addVal,
      }
      let res3 = await performSave(fallbackPayload3)
      error = res3.error
    }

    if (error) throw error
  },

  async deleteDailyBalance(id) {
    if (String(id).startsWith('carried-')) return // Carried-forward synthetic record, no DB deletion needed
    const { error } = await supabase.from('daily_voucher_balances').delete().eq('id', id)
    if (error) throw error
  },

  // Distributions
  async getDistributions(marketerId, filters = {}) {
    let query = supabase.from('voucher_distributions').select('*, agents(*), voucher_packages(*), hostels(*)').eq('marketer_id', marketerId)
    if (filters.date) query = query.eq('dist_date', filters.date)
    if (filters.dateFrom) query = query.gte('dist_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('dist_date', filters.dateTo)
    if (filters.agentId) query = query.eq('agent_id', filters.agentId)
    if (filters.packageId) query = query.eq('package_id', filters.packageId)
    if (filters.hostelId) query = query.eq('hostel_id', filters.hostelId)
    const { data, error } = await query.order('dist_date', { ascending: false })
    if (error && (error.code === 'PGRST200' || error.message?.includes('hostels'))) {
      // Fallback query without hostels relation
      let fbQuery = supabase.from('voucher_distributions').select('*, agents(*), voucher_packages(*)').eq('marketer_id', marketerId)
      if (filters.date) fbQuery = fbQuery.eq('dist_date', filters.date)
      if (filters.dateFrom) fbQuery = fbQuery.gte('dist_date', filters.dateFrom)
      if (filters.dateTo) fbQuery = fbQuery.lte('dist_date', filters.dateTo)
      if (filters.agentId) fbQuery = fbQuery.eq('agent_id', filters.agentId)
      if (filters.packageId) fbQuery = fbQuery.eq('package_id', filters.packageId)
      const fbRes = await fbQuery.order('dist_date', { ascending: false })
      if (fbRes.error) throw fbRes.error
      return fbRes.data
    }
    if (error) throw error
    return data
  },
  async createDistribution(marketerId, payload) {
    const { data, error } = await supabase.rpc('distribute_vouchers', {
      p_marketer_id: marketerId,
      p_agent_id: payload.agent_id,
      p_package_id: payload.package_id,
      p_quantity: payload.quantity,
      p_dist_date: payload.dist_date,
      p_notes: payload.notes || null,
    })
    if (error) {
      // Fallback: direct insert if RPC not present in DB
      const { error: insertErr } = await supabase.from('voucher_distributions').insert({
        marketer_id: marketerId,
        agent_id: payload.agent_id,
        package_id: payload.package_id,
        hostel_id: payload.hostel_id || null,
        quantity: payload.quantity,
        dist_date: payload.dist_date,
        notes: payload.notes || null,
      })
      if (insertErr) throw insertErr
    }
    return data
  },
  async updateDistribution(id, updates) {
    const { error } = await supabase.from('voucher_distributions').update(updates).eq('id', id)
    if (error) throw error
  },
  async deleteDistribution(id) {
    const { error } = await supabase.from('voucher_distributions').delete().eq('id', id)
    if (error) throw error
  },

  // Direct Sales
  async getDirectSales(marketerId, filters = {}) {
    let query = supabase.from('direct_sales').select('*, voucher_packages(*), hostels(*)').eq('marketer_id', marketerId)
    if (filters.date) query = query.eq('sales_date', filters.date)
    if (filters.dateFrom) query = query.gte('sales_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('sales_date', filters.dateTo)
    if (filters.packageId) query = query.eq('package_id', filters.packageId)
    if (filters.hostelId) query = query.eq('hostel_id', filters.hostelId)
    const { data, error } = await query.order('sales_date', { ascending: false })
    if (error && (error.code === 'PGRST200' || error.message?.includes('hostels'))) {
      let fbQuery = supabase.from('direct_sales').select('*, voucher_packages(*)').eq('marketer_id', marketerId)
      if (filters.date) fbQuery = fbQuery.eq('sales_date', filters.date)
      if (filters.dateFrom) fbQuery = fbQuery.gte('sales_date', filters.dateFrom)
      if (filters.dateTo) fbQuery = fbQuery.lte('sales_date', filters.dateTo)
      if (filters.packageId) fbQuery = fbQuery.eq('package_id', filters.packageId)
      const fbRes = await fbQuery.order('sales_date', { ascending: false })
      if (fbRes.error) throw fbRes.error
      return fbRes.data
    }
    if (error) throw error
    return data
  },
  async createDirectSale(marketerId, payload) {
    const { error } = await supabase.from('direct_sales').insert({ ...payload, marketer_id: marketerId })
    if (error) throw error
  },
  async updateDirectSale(id, updates) {
    const { error } = await supabase.from('direct_sales').update(updates).eq('id', id)
    if (error) throw error
  },
  async deleteDirectSale(id) {
    const { error } = await supabase.from('direct_sales').delete().eq('id', id)
    if (error) throw error
  },

  // Agent Sales
  async getAgentSales(marketerId, filters = {}) {
    let query = supabase.from('agent_sales').select('*, agents(*), voucher_packages(*), hostels(*)').eq('marketer_id', marketerId)
    if (filters.date) query = query.eq('sales_date', filters.date)
    if (filters.dateFrom) query = query.gte('sales_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('sales_date', filters.dateTo)
    if (filters.agentId) query = query.eq('agent_id', filters.agentId)
    if (filters.packageId) query = query.eq('package_id', filters.packageId)
    if (filters.hostelId) query = query.eq('hostel_id', filters.hostelId)
    const { data, error } = await query.order('sales_date', { ascending: false })
    if (error && (error.code === 'PGRST200' || error.message?.includes('hostels'))) {
      let fbQuery = supabase.from('agent_sales').select('*, agents(*), voucher_packages(*)').eq('marketer_id', marketerId)
      if (filters.date) fbQuery = fbQuery.eq('sales_date', filters.date)
      if (filters.dateFrom) fbQuery = fbQuery.gte('sales_date', filters.dateFrom)
      if (filters.dateTo) fbQuery = fbQuery.lte('sales_date', filters.dateTo)
      if (filters.agentId) fbQuery = fbQuery.eq('agent_id', filters.agentId)
      if (filters.packageId) fbQuery = fbQuery.eq('package_id', filters.packageId)
      const fbRes = await fbQuery.order('sales_date', { ascending: false })
      if (fbRes.error) throw fbRes.error
      return fbRes.data
    }
    if (error) throw error
    return data
  },
  async createAgentSale(marketerId, payload) {
    const { error } = await supabase.from('agent_sales').insert({ ...payload, marketer_id: marketerId })
    if (error) throw error
  },
  async updateAgentSale(id, updates) {
    const { error } = await supabase.from('agent_sales').update(updates).eq('id', id)
    if (error) throw error
  },
  async deleteAgentSale(id) {
    const { error } = await supabase.from('agent_sales').delete().eq('id', id)
    if (error) throw error
  },

  // Balance Helpers — Direct Live Database Queries
  async getMarketerBalance(marketerId, packageId, date) {
    if (!marketerId || !packageId) {
      return createStockResult(0, 0, 0, 0, 0, 0)
    }

    try {
      // 1. Fetch package list to find face_value of target packageId
      const pkgs = await this.getPackages()
      const targetPkg = (pkgs || []).find(p => p.id === packageId)
      const targetFaceVal = Number(targetPkg?.face_value || 0)

      const matchesPkg = (item) => {
        if (item.package_id === packageId) return true
        if (targetFaceVal > 0) {
          const itemVal = Number(item.voucher_packages?.face_value || item.face_value || 0)
          if (itemVal === targetFaceVal) return true
        }
        return false
      }

      // 2. Fetch daily stock balances for exact date (with auto carry-forward enabled)
      const balData = await this.getDailyBalance(marketerId, date || todayStr(), { autoCarryForward: true })

      // 3. Fetch distributions & direct sales for marketer
      const distQuery = supabase.from('voucher_distributions').select('*, voucher_packages(*)').eq('marketer_id', marketerId)
      const directQuery = supabase.from('direct_sales').select('*, voucher_packages(*)').eq('marketer_id', marketerId)
      if (date) {
        distQuery.eq('dist_date', date)
        directQuery.eq('sales_date', date)
      }

      const [distRes, directRes] = await Promise.all([distQuery, directQuery])

      const matchedBalances = (balData || []).filter(matchesPkg)
      const matchedDists = (distRes.data || []).filter(matchesPkg)
      const matchedDirects = (directRes.data || []).filter(matchesPkg)

      const totalInitial = matchedBalances.reduce((sum, b) => sum + Number(b.initial_qty ?? b.opening_balance ?? 0), 0)
      const totalAdditional = matchedBalances.reduce((sum, b) => sum + Number(b.additional_qty ?? b.additional_stock ?? 0), 0)
      const totalAvailable = totalInitial + totalAdditional
      const totalDist = matchedDists.reduce((sum, d) => sum + Number(d.quantity || 0), 0)
      const totalDirect = matchedDirects.reduce((sum, d) => sum + Number(d.quantity_sold ?? d.quantity ?? 0), 0)

      const netAvailable = Math.max(0, totalAvailable - totalDist - totalDirect)

      return createStockResult(netAvailable, totalInitial, totalAdditional, totalAvailable, totalDist, totalDirect)
    } catch (e) {
      console.error('Error fetching marketer balance:', e)
      return createStockResult(0, 0, 0, 0, 0, 0)
    }
  },

  async getAgentBalance(marketerId, agentId, packageId, date) {
    const [distRes, salesRes] = await Promise.all([
      supabase.from('voucher_distributions')
        .select('quantity')
        .eq('marketer_id', marketerId)
        .eq('agent_id', agentId)
        .eq('package_id', packageId)
        .lte('dist_date', date),
      supabase.from('agent_sales')
        .select('quantity_sold')
        .eq('marketer_id', marketerId)
        .eq('agent_id', agentId)
        .eq('package_id', packageId)
        .lte('sales_date', date)
    ])

    const totalDist = (distRes.data || []).reduce((sum, d) => sum + Number(d.quantity || 0), 0)
    const totalSales = (salesRes.data || []).reduce((sum, s) => sum + Number(s.quantity_sold || 0), 0)

    return Math.max(0, totalDist - totalSales)
  }
}
