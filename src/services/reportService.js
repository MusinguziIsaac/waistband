import { supabase } from './supabase'
import { salesService } from './salesService'
import { generatePDF } from '../utils/pdfExport'
import { toLocalDateStr, formatPackageDisplayName, dedupeAndNormalizeSummary } from '../utils/formatting'

export const reportService = {
  async getReports(marketerId) {
    let dbReports = []
    try {
      const { data, error } = await supabase.from('reports')
        .select('*')
        .eq('marketer_id', marketerId)
        .order('created_at', { ascending: false })
      if (!error && data) {
        dbReports = data
      }
    } catch (e) {
      console.warn('Could not query reports table:', e)
    }

    const localReports = JSON.parse(localStorage.getItem(`saved_reports_${marketerId}`) || '[]')
    const combined = [...dbReports]
    localReports.forEach(lr => {
      const exists = combined.some(r => r.id === lr.id || (r.date_from === lr.date_from && r.report_type === lr.report_type))
      if (!exists) {
        combined.push(lr)
      }
    })

    return combined
      .sort((a, b) => new Date(b.created_at || b.date_from).getTime() - new Date(a.created_at || a.date_from).getTime())
      .map(r => ({
        ...r,
        summary_data: dedupeAndNormalizeSummary(r.summary_data || [])
      }))
  },
  async computeSummaryFromTables(marketerId, dateFrom, dateTo) {
    const ALLOWED = new Set([500, 1000, 6000, 20000, 80000])

    // 1. Get canonical packages using salesService
    const packages = await salesService.getPackages()
    let pkgList = (packages || []).filter(p => ALLOWED.has(Number(p.face_value)))
    if (pkgList.length === 0) {
      pkgList = [
        { id: '00000000-0000-4000-a000-000000000500', name: 'Economy', face_value: 500 },
        { id: '00000000-0000-4000-a000-000000001000', name: 'Daily', face_value: 1000 },
        { id: '00000000-0000-4000-a000-000000006000', name: 'Weekly', face_value: 6000 },
        { id: '00000000-0000-4000-a000-000000020000', name: 'Monthly', face_value: 20000 },
        { id: '00000000-0000-4000-a000-000000080000', name: 'Semester', face_value: 80000 }
      ]
    }

    // 2. Fetch live data from all 4 transaction tables directly from database
    const [balances, dists, directs, agents] = await Promise.all([
      salesService.getDailyBalance(marketerId, dateFrom),
      salesService.getDistributions(marketerId, { dateFrom, dateTo }),
      salesService.getDirectSales(marketerId, { dateFrom, dateTo }),
      salesService.getAgentSales(marketerId, { dateFrom, dateTo })
    ])

    const balList = balances || []
    const distList = dists || []
    const directList = directs || []
    const agentList = agents || []

    // 3. Aggregate totals per package directly from table records
    const rawSummary = pkgList.map(pkg => {
      const pId = pkg.id
      const fVal = Number(pkg.face_value)
      const displayName = formatPackageDisplayName({ ...pkg, face_value: fVal })

      const matchesPkg = (item) => {
        if (item.package_id === pId) return true
        const itemVal = Number(item.voucher_packages?.face_value || item.face_value || 0)
        return itemVal === fVal
      }

      const pkgBalances = balList.filter(matchesPkg)
      const initialQty = pkgBalances.reduce((sum, b) => sum + Number(b.initial_qty ?? b.opening_balance ?? 0), 0)
      const addQty = pkgBalances.reduce((sum, b) => sum + Number(b.additional_qty ?? b.additional_stock ?? 0), 0)
      const totalAvail = initialQty + addQty

      const pkgDists = distList.filter(matchesPkg)
      const distQty = pkgDists.reduce((sum, d) => sum + Number(d.quantity || 0), 0)

      const pkgDirects = directList.filter(matchesPkg)
      const directQty = pkgDirects.reduce((sum, d) => sum + Number(d.quantity ?? d.quantity_sold ?? 0), 0)
      const directReceived = pkgDirects.reduce((sum, d) => sum + Number(d.amount_received || 0), 0)

      const pkgAgents = agentList.filter(matchesPkg)
      const agentQty = pkgAgents.reduce((sum, a) => sum + Number(a.quantity ?? a.quantity_sold ?? 0), 0)
      const agentGiven = pkgAgents.reduce((sum, a) => sum + Number(a.initial_vouchers_given ?? a.quantity ?? a.quantity_sold ?? 0), 0)
      const agentComm = pkgAgents.reduce((sum, a) => sum + Number(a.commission_amount || 0), 0)
      const agentReceived = pkgAgents.reduce((sum, a) => sum + Number(a.amount_received || 0), 0)

      const directExpected = directQty * fVal
      const agentExpected = Math.max(0, (agentGiven * fVal) - agentComm)

      const totalSold = directQty + agentQty
      const totalUnsold = Math.max(0, totalAvail - distQty - directQty)
      const expectedRev = directExpected + agentExpected
      const totalReceived = directReceived + agentReceived
      const variance = totalReceived - expectedRev

      const hostelNamesList = Array.from(new Set(
        [...pkgDirects, ...pkgAgents]
          .map(i => i.hostels?.name || i.hostel_name)
          .filter(Boolean)
      ))
      const hostelName = hostelNamesList.length > 0 ? hostelNamesList.join(', ') : 'All Hostels'

      return {
        package_id: pId,
        package_name: displayName,
        face_value: fVal,
        hostel_name: hostelName,
        initial_qty: initialQty,
        additional_qty: addQty,
        total_available: totalAvail,
        distributed_qty: distQty,
        direct_sales_qty: directQty,
        agent_sales_qty: agentQty,
        total_sold_qty: totalSold,
        total_unsold: totalUnsold,
        expected_revenue: expectedRev,
        amount_received: totalReceived,
        variance: variance
      }
    })

    return dedupeAndNormalizeSummary(rawSummary)
  },

  async generateDailyReport(marketerId, date) {
    try {
      const { data, error } = await supabase.rpc('get_daily_summary', {
        p_marketer_id: marketerId,
        p_date: date,
        p_package_id: null
      })
      if (!error && data && data.length > 0) {
        return { type: 'Daily', dateFrom: date, dateTo: date, summary: dedupeAndNormalizeSummary(data) }
      }
    } catch (e) {
      // Fall through to direct table queries
    }

    const summary = await this.computeSummaryFromTables(marketerId, date, date)
    return { type: 'Daily', dateFrom: date, dateTo: date, summary: dedupeAndNormalizeSummary(summary) }
  },

  async generateWeeklyReport(marketerId, date) {
    const d = new Date(`${date}T00:00:00`)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const startOfWeek = new Date(d)
    startOfWeek.setDate(d.getDate() + diff)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const dateFrom = toLocalDateStr(startOfWeek)
    const dateTo = toLocalDateStr(endOfWeek)

    try {
      const { data, error } = await supabase.rpc('get_weekly_summary', {
        p_marketer_id: marketerId,
        p_date: date,
        p_package_id: null
      })
      if (!error && data && data.length > 0) {
        return { type: 'Weekly', dateFrom, dateTo, summary: dedupeAndNormalizeSummary(data) }
      }
    } catch (e) {
      // Fall through to direct table queries
    }

    const summary = await this.computeSummaryFromTables(marketerId, dateFrom, dateTo)
    return { type: 'Weekly', dateFrom, dateTo, summary: dedupeAndNormalizeSummary(summary) }
  },
  async getWeeklyDailyBreakdown(marketerId, date) {
    const d = new Date(`${date}T00:00:00`)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const startOfWeek = new Date(d)
    startOfWeek.setDate(d.getDate() + diff)

    const days = []
    const dateStrings = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek)
      current.setDate(startOfWeek.getDate() + i)
      const ds = toLocalDateStr(current)
      dateStrings.push(ds)
      days.push({
        date: ds,
        dayName: current.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        expected_revenue: 0,
        amount_received: 0
      })
    }

    const startDateStr = dateStrings[0]
    const endDateStr = dateStrings[6]

    const [packages, directSales, agentSales] = await Promise.all([
      salesService.getPackages(),
      salesService.getDirectSales(marketerId, { dateFrom: startDateStr, dateTo: endDateStr }),
      salesService.getAgentSales(marketerId, { dateFrom: startDateStr, dateTo: endDateStr })
    ])

    const pkgMap = {}
    ;(packages || []).forEach(p => {
      pkgMap[p.id] = Number(p.face_value)
      if (p.name) pkgMap[p.name.toLowerCase()] = Number(p.face_value)
    })

    const FALLBACK_FACE_VALUES = {
      'pkg-economy': 500,
      'pkg-daily': 1000,
      'pkg-weekly': 6000,
      'pkg-monthly': 20000,
      'pkg-semester': 80000,
      economy: 500,
      daily: 1000,
      weekly: 6000,
      monthly: 20000,
      semester: 80000
    }

    const getFaceVal = (record) => {
      if (record.voucher_packages?.face_value) return Number(record.voucher_packages.face_value)
      if (record.face_value) return Number(record.face_value)
      if (record.package_id && pkgMap[record.package_id]) return pkgMap[record.package_id]
      if (record.package_id && FALLBACK_FACE_VALUES[record.package_id]) return FALLBACK_FACE_VALUES[record.package_id]
      return 0
    }

    const map = {}
    days.forEach(item => { map[item.date] = item })

    if (directSales && directSales.length > 0) {
      directSales.forEach(s => {
        const sDate = s.sales_date ? s.sales_date.split('T')[0] : (s.created_at ? s.created_at.split('T')[0] : '')
        if (map[sDate]) {
          const qty = Number(s.quantity ?? s.quantity_sold ?? 0)
          const fVal = getFaceVal(s)
          const expected = qty * fVal
          const received = Number(s.amount_received || 0)
          map[sDate].expected_revenue += expected
          map[sDate].amount_received += received
        }
      })
    }

    if (agentSales && agentSales.length > 0) {
      agentSales.forEach(s => {
        const sDate = s.sales_date ? s.sales_date.split('T')[0] : (s.created_at ? s.created_at.split('T')[0] : '')
        if (map[sDate]) {
          const given = Number(s.initial_vouchers_given ?? s.quantity ?? s.quantity_sold ?? 0)
          const fVal = getFaceVal(s)
          const comm = Number(s.commission_amount || 0)
          const expected = Math.max(0, (given * fVal) - comm)
          const received = Number(s.amount_received || 0)
          map[sDate].expected_revenue += expected
          map[sDate].amount_received += received
        }
      })
    }

    return days
  },
  async saveReport(marketerId, reportData) {
    const reportId = reportData.id || `report-${reportData.type.toLowerCase()}-${reportData.dateFrom}-${Date.now()}`
    const payload = {
      id: reportId,
      marketer_id: marketerId,
      report_type: reportData.type.toLowerCase(),
      date_from: reportData.dateFrom,
      date_to: reportData.dateTo,
      summary_data: reportData.summary,
      status: reportData.status || 'draft',
      updated_at: new Date().toISOString()
    }

    // 1. Try Supabase
    try {
      if (reportData.id && !String(reportData.id).startsWith('report-')) {
        await supabase.from('reports').update({
          summary_data: reportData.summary,
          updated_at: new Date().toISOString()
        }).eq('id', reportData.id).eq('marketer_id', marketerId)
      } else {
        await supabase.from('reports').insert(payload)
      }
    } catch (e) {
      console.warn('Could not persist report to Supabase, saving locally:', e)
    }

    // 2. Always persist locally for offline resilience
    const localReports = JSON.parse(localStorage.getItem(`saved_reports_${marketerId}`) || '[]')
    const existingIndex = localReports.findIndex(r => r.id === reportId || (r.date_from === payload.date_from && r.report_type === payload.report_type))
    if (existingIndex >= 0) {
      localReports[existingIndex] = { ...localReports[existingIndex], ...payload }
    } else {
      localReports.unshift({ ...payload, created_at: new Date().toISOString() })
    }
    localStorage.setItem(`saved_reports_${marketerId}`, JSON.stringify(localReports))

    return payload
  },
  async deleteReport(reportId, marketerId) {
    try {
      await supabase.from('reports').delete().eq('id', reportId).eq('marketer_id', marketerId)
    } catch (e) {
      console.warn('Could not delete report from Supabase:', e)
    }

    const localReports = JSON.parse(localStorage.getItem(`saved_reports_${marketerId}`) || '[]')
    const filtered = localReports.filter(r => r.id !== reportId)
    localStorage.setItem(`saved_reports_${marketerId}`, JSON.stringify(filtered))
  },
  async submitReport(reportId, marketerId) {
    try {
      await supabase.from('reports')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', reportId)
        .eq('marketer_id', marketerId)
    } catch (e) {
      console.warn('Could not submit report to Supabase:', e)
    }

    const localReports = JSON.parse(localStorage.getItem(`saved_reports_${marketerId}`) || '[]')
    const updated = localReports.map(r => r.id === reportId ? { ...r, status: 'submitted', submitted_at: new Date().toISOString() } : r)
    localStorage.setItem(`saved_reports_${marketerId}`, JSON.stringify(updated))
  },
  downloadPDF(reportData, profile, elementId = 'report-preview-content') {
    return generatePDF(reportData, profile, elementId)
  },
  exportCSV(reportData) {
    if (!reportData.summary || reportData.summary.length === 0) return
    
    const headers = [
      'Package',
      'Initial Qty',
      'Additional Qty',
      'Total Available',
      'Distributed Qty',
      'Direct Sales Qty',
      'Agent Sales Qty',
      'Total Sold',
      'Total Unsold',
      'Expected Revenue (UGX)',
      'Amount Received (UGX)',
      'Variance (UGX)'
    ]
    
    const rows = reportData.summary.map(r => [
      r.package_name,
      r.initial_qty,
      r.additional_qty,
      r.total_available,
      r.distributed_qty,
      r.direct_sales_qty,
      r.agent_sales_qty,
      r.total_sold_qty,
      r.total_unsold,
      r.expected_revenue,
      r.amount_received,
      r.variance
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n")
      
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `WAISTBAND_${reportData.type}_Report_${reportData.dateFrom}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
