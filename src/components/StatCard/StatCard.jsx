export default function StatCard({ title, value, subtitle, icon: Icon, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-primary-50 text-primary-600', // using primary green for success
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-danger',
    info: 'bg-blue-50 text-blue-600',
  }

  const iconBg = colorMap[color] || colorMap.primary

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-label">{title}</div>
          <div className="stat-value mt-1">{value}</div>
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon size={20} />
        </div>
      </div>
      {subtitle && <div className="stat-sub">{subtitle}</div>}
    </div>
  )
}
