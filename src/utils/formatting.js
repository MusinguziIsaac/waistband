export const formatUGX = (amount) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Compact "1,000 USh" style used on charts / axis ticks
export const formatUSh = (amount) => {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} USh`
}

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num)
}

// Parse a date input safely in LOCAL time, returning a Date or invalid Date instance
export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date(NaN)
  if (dateString instanceof Date) return dateString
  const str = String(dateString).trim()
  if (!str) return new Date(NaN)
  const dt = str.includes('T') ? new Date(str) : new Date(`${str}T00:00:00`)
  return isNaN(dt.getTime()) ? new Date(NaN) : dt
}

export const formatDate = (dateString) => {
  if (!dateString) return ''
  const dt = parseLocalDate(dateString)
  if (isNaN(dt.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(dt)
}

export const formatDateShort = (dateString) => {
  if (!dateString) return ''
  const dt = parseLocalDate(dateString)
  if (isNaN(dt.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(dt)
}

export const formatDateTime = (dateString) => {
  if (!dateString) return ''
  const dt = parseLocalDate(dateString)
  if (isNaN(dt.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dt)
}

// Build a YYYY-MM-DD string from LOCAL date parts — never use toISOString() for this
export const toLocalDateStr = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Today's date as YYYY-MM-DD in the user's local timezone
export const todayStr = () => toLocalDateStr(new Date())

// Yesterday's date as YYYY-MM-DD in the user's local timezone
export const yesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalDateStr(d)
}

export const initials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export const varianceClass = (variance) => {
  if (variance > 0) return 'text-primary-600'
  if (variance < 0) return 'text-danger'
  return 'text-text-secondary'
}

export const TIER_NAMES = {
  500:   'Economy',
  1000:  'Daily',
  6000:  'Weekly',
  20000: 'Monthly',
  80000: 'Semester',
}

export const formatPackageDisplayName = (row) => {
  if (!row) return ''
  let fVal = Number(row.face_value || row.voucher_packages?.face_value || 0)
  
  if (!fVal && (row.package_name || row.name)) {
    const str = String(row.package_name || row.name)
    const match = str.match(/\d+/)
    if (match) fVal = Number(match[0])
  }
  if (!fVal && row.package_id) {
    const match = String(row.package_id).match(/\d+/)
    if (match) fVal = Number(match[0])
  }

  const baseTier = TIER_NAMES[fVal] || row.package_name || row.name || 'Package'
  const cleanName = String(baseTier).split(':')[0].replace(/\d.*$/, '').trim() || 'Package'

  if (fVal > 0) {
    return `${cleanName}: ${fVal.toLocaleString()}/=`
  }
  return cleanName
}

const ALLOWED_VALUES = new Set([500, 1000, 6000, 20000, 80000])
const EXCLUDED_VALUES = new Set([2000, 5000, 10000])

export const dedupeAndNormalizeSummary = (summary) => {
  if (!Array.isArray(summary) || summary.length === 0) return []

  const mapByVal = new Map()

  summary.forEach(row => {
    let fVal = Number(row.face_value || row.voucher_packages?.face_value || 0)
    if (!fVal && (row.package_name || row.name)) {
      const str = String(row.package_name || row.name).replace(/,/g, '')
      const match = str.match(/\d+/)
      if (match) fVal = Number(match[0])
    }
    if (!fVal && row.package_id) {
      const match = String(row.package_id).match(/\d+/)
      if (match) fVal = Number(match[0])
    }

    // Exclude packages for 2000, 5000, 10000 and non-canonical face values
    if (EXCLUDED_VALUES.has(fVal)) return
    if (fVal > 0 && !ALLOWED_VALUES.has(fVal)) return

    const displayName = formatPackageDisplayName({ ...row, face_value: fVal })
    const key = fVal || displayName

    if (!mapByVal.has(key)) {
      mapByVal.set(key, {
        ...row,
        package_id: row.package_id || `pkg-${fVal}`,
        package_name: displayName,
        face_value: fVal,
        hostel_name: row.hostel_name || 'All Hostels',
        initial_qty: Number(row.initial_qty || 0),
        additional_qty: Number(row.additional_qty || 0),
        total_available: Number(row.total_available || (Number(row.initial_qty || 0) + Number(row.additional_qty || 0))),
        distributed_qty: Number(row.distributed_qty || 0),
        direct_sales_qty: Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty ?? 0),
        agent_sales_qty: Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty ?? 0),
        total_sold_qty: Number(row.total_sold_qty ?? ((Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty ?? 0)) + (Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty ?? 0)))),
        total_unsold: Number(row.total_unsold || 0),
        expected_revenue: Number(row.expected_revenue || 0),
        amount_received: Number(row.amount_received || 0),
        variance: Number(row.variance || 0)
      })
    } else {
      const existing = mapByVal.get(key)
      if (row.hostel_name && row.hostel_name !== 'All Hostels') {
        const existingHostels = (existing.hostel_name || '').split(', ').filter(h => h && h !== 'All Hostels')
        if (!existingHostels.includes(row.hostel_name)) {
          existingHostels.push(row.hostel_name)
          existing.hostel_name = existingHostels.join(', ') || 'All Hostels'
        }
      }
      existing.initial_qty += Number(row.initial_qty || 0)
      existing.additional_qty += Number(row.additional_qty || 0)
      existing.total_available += Number(row.total_available || 0)
      existing.distributed_qty += Number(row.distributed_qty || 0)
      existing.direct_sales_qty += Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty ?? 0)
      existing.agent_sales_qty += Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty ?? 0)
      existing.total_sold_qty += Number(row.total_sold_qty ?? ((Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty ?? 0)) + (Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty ?? 0))))
      existing.total_unsold += Number(row.total_unsold || 0)
      existing.expected_revenue += Number(row.expected_revenue || 0)
      existing.amount_received += Number(row.amount_received || 0)
      existing.variance += Number(row.variance || 0)
    }
  })

  return Array.from(mapByVal.values()).sort((a, b) => (a.face_value || 0) - (b.face_value || 0))
}

