import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts'
import { api, type Metric, type Entry } from '../lib/api'
import LogEntryModal from '../components/LogEntryModal'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MetricDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [metric, setMetric] = useState<Metric | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [logging, setLogging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<30 | 90>(30)

  useEffect(() => {
    if (!id) return
    const from = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      api.metrics.list().then(ms => ms.find(m => m.id === id)),
      api.entries.list({ metricDefId: id, from }),
    ]).then(([m, e]) => {
      if (!m) { navigate('/'); return }
      setMetric(m)
      setEntries(e)
    }).finally(() => setLoading(false))
  }, [id, range])

  async function handleSave(value: number | string, loggedAt: string) {
    if (!metric) return
    const entry = await api.entries.create({
      metricDefId: metric.id,
      ...(typeof value === 'number' ? { numericValue: value } : { textValue: value }),
      loggedAt,
    })
    setEntries(prev => [entry, ...prev])
  }

  async function handleDelete(entryId: string) {
    await api.entries.delete(entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading…</div>
  if (!metric) return null

  const chartData = [...entries]
    .reverse()
    .filter(e => e.numericValue !== null)
    .map(e => ({ date: formatDate(e.loggedAt), value: e.numericValue }))

  const color = metric.color ?? '#3b82f6'
  const useBar = metric.type === 'BOOLEAN'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h1 className="text-xl font-semibold text-gray-900">{metric.name}</h1>
          {metric.unit && <span className="text-sm text-gray-400">{metric.unit}</span>}
        </div>
        <button
          onClick={() => setLogging(true)}
          className="ml-auto text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium transition-colors"
        >
          Log entry
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-500">History</h2>
            <div className="flex gap-1">
              {([30, 90] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${range === r ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              {useBar ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No entries in this period
            </div>
          )}
        </div>

        <section>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">All entries</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.numericValue !== null
                        ? `${entry.numericValue}${metric.unit ? ' ' + metric.unit : ''}`
                        : entry.textValue}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(entry.loggedAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {logging && (
        <LogEntryModal
          metric={metric}
          onSave={handleSave}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  )
}
