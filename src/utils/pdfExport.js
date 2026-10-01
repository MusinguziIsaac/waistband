import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { formatUGX, formatNumber, formatDate, formatDateShort, formatPackageDisplayName } from './formatting'
import { aggregateSummary } from './calculations'

export async function generatePDF(reportData, profile, elementId = 'report-preview-content') {
  const element = document.getElementById(elementId)

  if (element) {
    try {
      // Clone the element outside the modal so overflow/scroll does not clip it
      const clone = element.cloneNode(true)

      clone.style.position = 'fixed'
      clone.style.top = '-99999px'
      clone.style.left = '0'
      clone.style.width = '1200px'
      clone.style.maxWidth = 'none'
      clone.style.height = 'auto'
      clone.style.maxHeight = 'none'
      clone.style.overflow = 'visible'
      clone.style.zIndex = '-1'
      clone.style.background = '#ffffff'

      // Un-clip any overflow-x-auto / overflow-y-auto wrappers inside the clone
      clone.querySelectorAll('*').forEach(el => {
        const cs = window.getComputedStyle(el)
        if (
          cs.overflow === 'auto' || cs.overflow === 'scroll' ||
          cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
          cs.overflowY === 'auto' || cs.overflowY === 'scroll'
        ) {
          el.style.overflow = 'visible'
          el.style.overflowX = 'visible'
          el.style.overflowY = 'visible'
          el.style.maxHeight = 'none'
          el.style.height = 'auto'
        }
      })

      document.body.appendChild(clone)

      // Give browser two frames to fully lay out the clone
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      })

      document.body.removeChild(clone)

      const imgData = canvas.toDataURL('image/png')
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth  = doc.internal.pageSize.getWidth()  // 297mm
      const pageHeight = doc.internal.pageSize.getHeight() // 210mm
      const margin = 10
      const printableWidth  = pageWidth  - margin * 2
      const printableHeight = pageHeight - margin * 2

      const imgWidth  = printableWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let yOffset    = 0  // mm of the image already printed

      // First page
      doc.addImage(imgData, 'PNG', margin, margin - yOffset, imgWidth, imgHeight)
      heightLeft -= printableHeight
      yOffset    += printableHeight

      // Additional pages
      while (heightLeft > 0) {
        doc.addPage()
        doc.addImage(imgData, 'PNG', margin, margin - yOffset, imgWidth, imgHeight)
        heightLeft -= printableHeight
        yOffset    += printableHeight
      }

      doc.save(`WAISTBAND_${reportData.type}_Report_${reportData.dateFrom}.pdf`)
      return
    } catch (e) {
      console.warn('html2canvas rendering failed, falling back to autoTable PDF', e)
    }
  }

  // Fallback to standard autoTable PDF if element is not in DOM
  const doc = new jsPDF('landscape')
  
  // Header
  doc.setFontSize(16)
  doc.setTextColor(22, 163, 74) // Primary green
  doc.text('WAISTBAND HUB LTD', 14, 15)
  
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Fast & Reliable Internet', 14, 22)
  
  // Meta
  doc.setTextColor(15, 23, 42)
  doc.text(`${reportData.type} Report`, 14, 32)
  
  const dateStr = reportData.dateFrom === reportData.dateTo 
    ? formatDate(reportData.dateFrom)
    : `${formatDateShort(reportData.dateFrom)} to ${formatDateShort(reportData.dateTo)}`
    
  doc.text(`Period: ${dateStr}`, 14, 38)
  doc.text(`Marketer: ${profile?.full_name || 'General Marketer'}`, 14, 44)
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 50)

  if (!reportData.summary || reportData.summary.length === 0) {
    doc.text('No data available for this period.', 14, 65)
    doc.save(`WAISTBAND_${reportData.type}_Report_${reportData.dateFrom}.pdf`)
    return
  }

  const totals = aggregateSummary(reportData.summary)

  const head = [[
    'Package',
    'Hostel / Rental',
    'Direct Sales',
    'Agent Sales',
    'Total Sold',
    'Expected Revenue',
    'Amount Received',
    'Variance'
  ]]

  const body = reportData.summary.map(r => [
    formatPackageDisplayName(r) || r.package_name || 'Package',
    r.hostel_name || r.location || 'All Hostels',
    formatNumber(Number(r.direct_sales_qty ?? r.direct_sold_qty ?? r.direct_sales ?? r.direct_qty) || 0),
    formatNumber(Number(r.agent_sales_qty ?? r.agent_sold_qty ?? r.agent_sales ?? r.agent_qty) || 0),
    formatNumber(Number(r.total_sold_qty ?? ((Number(r.direct_sales_qty ?? r.direct_sold_qty ?? r.direct_sales ?? r.direct_qty ?? 0)) + (Number(r.agent_sales_qty ?? r.agent_sold_qty ?? r.agent_sales ?? r.agent_qty ?? 0)))) || 0),
    formatUGX(r.expected_revenue),
    formatUGX(r.amount_received),
    formatUGX(r.variance)
  ])

  body.push([
    'TOTAL',
    '—',
    formatNumber(totals.direct_sales_qty),
    formatNumber(totals.agent_sales_qty),
    formatNumber(totals.total_sold_qty),
    formatUGX(totals.expected_revenue),
    formatUGX(totals.amount_received),
    formatUGX(totals.variance)
  ])

  autoTable(doc, {
    startY: 55,
    head: head,
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [240, 253, 244]
      }
      if (data.column.index === 7 && data.row.index < body.length - 1) {
        const val = reportData.summary[data.row.index].variance
        if (val > 0) data.cell.styles.textColor = [22, 163, 74]
        if (val < 0) data.cell.styles.textColor = [220, 38, 38]
      } else if (data.column.index === 7 && data.row.index === body.length - 1) {
        if (totals.variance > 0) data.cell.styles.textColor = [22, 163, 74]
        if (totals.variance < 0) data.cell.styles.textColor = [220, 38, 38]
      }
    }
  })

  doc.save(`WAISTBAND_${reportData.type}_Report_${reportData.dateFrom}.pdf`)
}

