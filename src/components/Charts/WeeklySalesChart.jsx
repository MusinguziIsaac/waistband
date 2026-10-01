import { useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatUGX, parseLocalDate } from '../../utils/formatting'

export default function WeeklySalesChart({ data, viewType = 'daily' }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set())

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-text-secondary bg-slate-50/50 rounded-lg border border-dashed border-border p-4 text-center">
        <p className="font-semibold text-text-primary text-sm">No sales data recorded for this period.</p>
        <p className="text-xs text-text-secondary mt-1">Record direct or agent sales to view performance chart stats.</p>
      </div>
    )
  }

  const chartData = data.map(d => {
    let name = d.dayName || ''
    const rawDate = d.date || d.sales_date || d.dist_date || d.created_at
    if (!name && rawDate) {
      const dt = parseLocalDate(rawDate)
      if (!isNaN(dt.getTime())) {
        name = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      }
    }
    if (!name || name === 'Invalid Date') {
      name = d.package_name || d.name || d.label || d.day || 'Package'
    }

    return {
      name,
      Expected: Number(d.expected_revenue || 0),
      Received: Number(d.amount_received || 0),
      Variance: Number((d.amount_received || 0) - (d.expected_revenue || 0))
    }
  })

  const handleLegendClick = (e) => {
    const dataKey = e.dataKey
    setHiddenKeys(prev => {
      const next = new Set(prev)
      if (next.has(dataKey)) {
        next.delete(dataKey)
      } else {
        next.add(dataKey)
      }
      return next
    })
  }

  const yTickFormatter = (val) => formatUGX(val)

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={yTickFormatter}
            width={95}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload
                return (
                  <div className="bg-white p-3 rounded-lg border border-border shadow-lg text-xs space-y-1.5 min-w-44">
                    <p className="font-bold text-text-primary text-sm border-b border-border pb-1 mb-1.5">{label}</p>
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                        Amount Received:
                      </span>
                      <span className="font-bold text-emerald-600">{formatUGX(item.Received)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span>
                        Expected Revenue:
                      </span>
                      <span className="font-semibold text-text-primary">{formatUGX(item.Expected)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border pt-1.5 mt-1">
                      <span>Variance:</span>
                      <span className={`font-bold ${item.Variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatUGX(item.Variance)}
                      </span>
                    </div>
                  </div>
                )
              }
              return null
            }}
            cursor={{ fill: '#f8fafc' }}
          />
          <Legend
            iconType="circle"
            onClick={handleLegendClick}
            wrapperStyle={{ paddingTop: '20px', cursor: 'pointer', userSelect: 'none' }}
          />
          
          {/* Amount Received Bar */}
          {!hiddenKeys.has('Received') && (
            <Bar
              dataKey="Received"
              name="Amount Received"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={42}
            />
          )}

          {/* Expected Revenue Line */}
          {!hiddenKeys.has('Expected') && (
            <Line
              type="monotone"
              dataKey="Expected"
              name="Expected Revenue"
              stroke="#334155"
              strokeWidth={3}
              dot={{ r: 5, fill: '#334155', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
