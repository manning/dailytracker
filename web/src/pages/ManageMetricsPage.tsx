import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, Metric, MetricType } from '../lib/api'
import { clearAuth } from '../lib/auth'
import { parseDuration, formatDuration, naturalUnitFromMetricUnit } from '../lib/duration'

const PRESET_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#d97706', '#16a34a', '#0891b2',
  '#64748b', '#111827',
]

const TYPES: MetricType[] = ['NUMBER', 'SCALE', 'BOOLEAN', 'DURATION', 'CATEGORICAL', 'TEXT']
const TYPE_LABELS: Record<MetricType, string> = {
  NUMBER: 'Number', SCALE: 'Scale', BOOLEAN: 'Tag',
  DURATION: 'Duration', CATEGORICAL: 'Category', TEXT: 'Text',
}

interface FormState {
  name: string
  type: MetricType
  unit: string
  color: string
  allowMultiplePerDay: boolean
  scaleMin: string
  scaleMax: string
  defaultValue: string
}

const blankForm = (): FormState => ({
  name: '', type: 'NUMBER', unit: '', color: '#2563eb',
  allowMultiplePerDay: false, scaleMin: '0', scaleMax: '10', defaultValue: '',
})

function formFromMetric(m: Metric): FormState {
  let defaultValue = ''
  if (m.type === 'DURATION' && m.defaultNumericValue != null) {
    defaultValue = formatDuration(m.defaultNumericValue, naturalUnitFromMetricUnit(m.unit))
  } else if (m.defaultNumericValue != null) {
    defaultValue = String(m.defaultNumericValue)
  } else if (m.defaultTextValue) {
    defaultValue = m.defaultTextValue
  }
  return {
    name: m.name, type: m.type, unit: m.unit ?? '', color: m.color ?? '#2563eb',
    allowMultiplePerDay: m.allowMultiplePerDay,
    scaleMin: m.scaleMin != null ? String(m.scaleMin) : '0',
    scaleMax: m.scaleMax != null ? String(m.scaleMax) : '10',
    defaultValue,
  }
}

export default function ManageMetricsPage() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setMetrics(await api.metrics.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setShowForm(true)
  }

  function openEdit(m: Metric) {
    setEditingId(m.id)
    setForm(formFromMetric(m))
    setError('')
    setShowForm(true)
  }

  async function handleArchive(m: Metric) {
    if (!confirm(`Archive "${m.name}"? Your history will be preserved.`)) return
    await api.metrics.archive(m.id)
    load()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      let defaultNumericValue: number | null = null
      let defaultTextValue: string | null = null

      if (form.defaultValue.trim()) {
        if (['TEXT', 'CATEGORICAL'].includes(form.type)) {
          defaultTextValue = form.defaultValue.trim()
        } else if (form.type === 'DURATION') {
          const nu = naturalUnitFromMetricUnit(form.unit)
          defaultNumericValue = parseDuration(form.defaultValue, nu)
        } else {
          const n = Number(form.defaultValue)
          if (!Number.isNaN(n)) defaultNumericValue = n
        }
      }

      const payload = {
        name: form.name.trim(),
        type: form.type,
        unit: form.unit.trim() || null,
        color: form.color,
        allowMultiplePerDay: form.allowMultiplePerDay,
        scaleMin: form.type === 'SCALE' ? Number(form.scaleMin) || 0 : null,
        scaleMax: form.type === 'SCALE' ? Number(form.scaleMax) || 10 : null,
        defaultNumericValue,
        defaultTextValue,
      }

      if (editingId) {
        await api.metrics.update(editingId, payload)
      } else {
        await api.metrics.create(payload)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-gray-900">DailyTracker</Link>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600 font-medium">Manage Metrics</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/data" className="text-sm text-gray-500 hover:text-gray-700">Data</Link>
          <button onClick={() => { clearAuth(); navigate('/login') }} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add metric
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-12">Loading…</p>
        ) : (
          <div className="space-y-2">
            {metrics.length === 0 && (
              <p className="text-gray-400 text-center py-12">No metrics yet.</p>
            )}
            {metrics.map(m => (
              <div key={m.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color ?? '#64748b' }} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">
                    {TYPE_LABELS[m.type]}
                    {m.unit ? ` · ${m.unit}` : ''}
                    {m.type === 'SCALE' ? ` · ${m.scaleMin ?? 0}–${m.scaleMax ?? 10}` : ''}
                    {m.defaultNumericValue != null ? ` · default ${m.defaultNumericValue}` : ''}
                    {m.defaultTextValue ? ` · default "${m.defaultTextValue}"` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(m)} className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1">Edit</button>
                <button onClick={() => handleArchive(m)} className="text-sm text-red-500 hover:text-red-600 px-2 py-1">Archive</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Metric' : 'New Metric'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name} onChange={set('name')} placeholder="e.g. Weight" autoFocus
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`px-3 py-1.5 rounded-full text-sm border-2 font-medium transition-colors ${
                          form.type === t
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {['NUMBER', 'DURATION'].includes(form.type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.unit} onChange={set('unit')}
                    placeholder={form.type === 'DURATION' ? 'hours, minutes…' : 'lbs, km, reps…'}
                  />
                </div>
              )}

              {form.type === 'SCALE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scale range</label>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.scaleMin} onChange={set('scaleMin')} placeholder="Min" type="number"
                    />
                    <span className="text-gray-500">–</span>
                    <input
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.scaleMax} onChange={set('scaleMax')} placeholder="Max" type="number"
                    />
                  </div>
                </div>
              )}

              {form.type !== 'BOOLEAN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default value (optional)</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.defaultValue} onChange={set('defaultValue')}
                    placeholder={
                      form.type === 'DURATION' ? 'e.g. 7h 30m' :
                      form.type === 'SCALE'    ? `${form.scaleMin}–${form.scaleMax}` :
                      ['TEXT', 'CATEGORICAL'].includes(form.type) ? 'Default text' : 'Number'
                    }
                    type={['TEXT', 'CATEGORICAL', 'DURATION'].includes(form.type) ? 'text' : 'number'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: form.color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>

              {form.type !== 'BOOLEAN' && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowMultiplePerDay}
                    onChange={e => setForm(f => ({ ...f, allowMultiplePerDay: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow multiple entries per day</span>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
