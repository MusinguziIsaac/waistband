export function aggregateSummary(summaryData) {
  if (!summaryData || summaryData.length === 0) return null
  
  return summaryData.reduce((acc, row) => ({
    total_available: acc.total_available + (Number(row.total_available) || 0),
    distributed_qty: acc.distributed_qty + (Number(row.distributed_qty) || 0),
    direct_sales_qty: acc.direct_sales_qty + (Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty) || 0),
    agent_sales_qty: acc.agent_sales_qty + (Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty) || 0),
    total_sold_qty: acc.total_sold_qty + (Number(row.total_sold_qty ?? ((Number(row.direct_sales_qty ?? row.direct_sold_qty ?? row.direct_sales ?? row.direct_qty ?? 0)) + (Number(row.agent_sales_qty ?? row.agent_sold_qty ?? row.agent_sales ?? row.agent_qty ?? 0)))) || 0),
    total_unsold: acc.total_unsold + (Number(row.total_unsold) || 0),
    expected_revenue: acc.expected_revenue + (Number(row.expected_revenue) || 0),
    amount_received: acc.amount_received + (Number(row.amount_received) || 0),
    variance: acc.variance + (Number(row.variance) || 0),
  }), {
    total_available: 0,
    distributed_qty: 0,
    direct_sales_qty: 0,
    agent_sales_qty: 0,
    total_sold_qty: 0,
    total_unsold: 0,
    expected_revenue: 0,
    amount_received: 0,
    variance: 0
  })
}
