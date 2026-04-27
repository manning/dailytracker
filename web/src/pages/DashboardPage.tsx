import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Metric, type Entry } from '../lib/api'
import { clearAuth, getUser } from '../lib/auth'
import LogEntryModal from '../components/LogEntryModal'

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getUser()
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [todayEntries, setTodayEntries] = useState<Entry[]>([])
  const [logging, setLogging] = useState<Metric | null>(null)
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

  useEffect(() => {
    Promise.all([api.metrics.list(), api.entries.list({ from, to })])
      .then(([m, e]) => { setMetrics(m); setTodayEntries(e) })
      .catch(() => { clearAuth(); navigate('/login') })
      .finally(() => setLoading(false))
  }, [])

  function isLoggedToday(metric: Metric) {
    return todayEntries.some(e => e.metricDefId === metric.id)
  }

  function todayValue(metric: Metric) {
    const entry = todayEntries.find(e => e.metricDefId === metric.id)
    if (!entry) return null
    if (entry.numericValue !== null) return `${entry.numericValue}${metric.unit ? ' ' + metric.unit : ''}`
    return entry.textValue
  }

  async function handleSave(metric: Metric, value: number | string, loggedAt: string) {
    const entry = await api.entries.create({
      metricDefId: metric.id,
      ...(typeof value === 'number' ? { numericValue: value } : { textValue: value }),
      loggedAt,
    })
    setTodayEntries(prev => [...prev, entry])
  }

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  const logged = metrics.filter(m => isLoggedToday(m))
  const remaining = metrics.filter(m => !isLoggedToday(m) || m.allowMultiplePerDay)

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">DailyTracker</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name ?? user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-sm text-gray-500">
            {logged.length}/{metrics.length} metrics logged today
          </p>
        </div>

        {remaining.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">To log</h3>
            <div className="space-y-2">
              {remaining.map(metric => (
                <div key={metric.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: metric.color ?? '#94a3b8' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                      {metric.unit && <p className="text-xs text-gray-400">{metric.unit}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setLogging(metric)}
                    className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1.5 font-medium transition-colors"
                  >
                    Log
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {logged.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Logged today</h3>
            <div className="space-y-2">
              {logged.map(metric => (
                <Link key={metric.id} to={`/metrics/${metric.id}`} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between hover:border-blue-300 transition-colors block">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: metric.color ?? '#94a3b8' }} />
                    <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{todayValue(metric)}</span>
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {metrics.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No metrics yet.</div>
        )}
      </main>

      {logging && (
        <LogEntryModal
          metric={logging}
          onSave={(value, loggedAt) => handleSave(logging, value, loggedAt)}
          onClose={() => setLogging(null)}
        />
      )}
    </div>
  )
}
