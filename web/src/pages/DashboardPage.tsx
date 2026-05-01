import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Metric, type Entry } from '../lib/api'
import { clearAuth, getUser } from '../lib/auth'
import TagPicker from '../components/TagPicker'
import { formatDuration, naturalUnitFromMetricUnit, parseDuration } from '../lib/duration'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function dateRange(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return {
    from: new Date(y, m - 1, d, 0, 0, 0).toISOString(),
    to:   new Date(y, m - 1, d, 23, 59, 59).toISOString(),
  }
}

function loggedAtFor(dateStr: string): string {
  if (dateStr === todayStr()) return new Date().toISOString()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

function displayValue(metric: Metric, entry: Entry): string {
  if (entry.numericValue !== null) {
    if (metric.type === 'DURATION') return formatDuration(entry.numericValue, naturalUnitFromMetricUnit(metric.unit))
    return `${entry.numericValue}${metric.unit ? ' ' + metric.unit : ''}`
  }
  return entry.textValue ?? ''
}

function defaultInputFor(metric: Metric): string {
  if (metric.type === 'DURATION' && metric.defaultNumericValue !== null)
    return formatDuration(metric.defaultNumericValue, naturalUnitFromMetricUnit(metric.unit))
  if ((metric.type === 'TEXT' || metric.type === 'CATEGORICAL') && metric.defaultTextValue)
    return metric.defaultTextValue
  if (metric.defaultNumericValue !== null && metric.defaultNumericValue !== undefined)
    return String(metric.defaultNumericValue)
  return ''
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getUser()
  const datePickerRef = useRef<HTMLInputElement>(null)

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({})
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({})
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({})

  const isToday = selectedDate === todayStr()

  // Fetch metrics once on mount
  useEffect(() => {
    api.metrics.list()
      .then(m => {
        setMetrics(m)
        setInlineValues(Object.fromEntries(m.map(metric => [metric.id, defaultInputFor(metric)])))
      })
      .catch(() => { clearAuth(); navigate('/login') })
      .finally(() => setMetricsLoading(false))
  }, [])

  // Re-fetch entries whenever the selected date changes
  useEffect(() => {
    setEntriesLoading(true)
    const { from, to } = dateRange(selectedDate)
    api.entries.list({ from, to })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setEntriesLoading(false))
  }, [selectedDate])

  function goBack() {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const prev = new Date(y, m - 1, d - 1)
    setSelectedDate(prev.toISOString().slice(0, 10))
  }

  function goForward() {
    if (isToday) return
    const [y, m, d] = selectedDate.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    setSelectedDate(next.toISOString().slice(0, 10))
  }

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    ...(selectedDate.slice(0, 4) !== todayStr().slice(0, 4) ? { year: 'numeric' } : {}),
  })

  const tags    = useMemo(() => metrics.filter(m => m.type === 'BOOLEAN'), [metrics])
  const nonTags = useMemo(() => metrics.filter(m => m.type !== 'BOOLEAN'), [metrics])

  const tagsLogged = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.numericValue === 1) set.add(e.metricDefId)
    return set
  }, [entries])

  function isLogged(metric: Metric) {
    return entries.some(e => e.metricDefId === metric.id)
  }

  async function handleInlineSave(metric: Metric) {
    const raw = (inlineValues[metric.id] ?? '').trim()
    if (!raw) return

    setInlineSaving(prev => ({ ...prev, [metric.id]: true }))
    setInlineErrors(prev => ({ ...prev, [metric.id]: '' }))
    try {
      let numericValue: number | undefined
      let textValue: string | undefined

      if (metric.type === 'TEXT' || metric.type === 'CATEGORICAL') {
        textValue = raw
      } else if (metric.type === 'DURATION') {
        const seconds = parseDuration(raw, naturalUnitFromMetricUnit(metric.unit))
        if (seconds === null) throw new Error('Try "7h 22m" or "7:22:00"')
        numericValue = seconds
      } else {
        const n = parseFloat(raw)
        if (isNaN(n)) throw new Error('Enter a number')
        numericValue = n
      }

      const entry = await api.entries.create({
        metricDefId: metric.id,
        numericValue,
        textValue,
        loggedAt: loggedAtFor(selectedDate),
      })
      setEntries(prev => [...prev, entry])
      setInlineValues(prev => ({ ...prev, [metric.id]: defaultInputFor(metric) }))
    } catch (err) {
      setInlineErrors(prev => ({ ...prev, [metric.id]: err instanceof Error ? err.message : 'Failed to save' }))
    } finally {
      setInlineSaving(prev => ({ ...prev, [metric.id]: false }))
    }
  }

  async function handleTagSave(newlySelected: Set<string>, newlyDeselected: Set<string>) {
    const loggedAt = loggedAtFor(selectedDate)
    const created: Entry[] = []
    for (const id of newlySelected) {
      const e = await api.entries.create({ metricDefId: id, numericValue: 1, loggedAt })
      created.push(e)
    }
    const toDelete = entries.filter(e => newlyDeselected.has(e.metricDefId))
    for (const e of toDelete) await api.entries.delete(e.id)
    setEntries(prev => [...prev.filter(e => !newlyDeselected.has(e.metricDefId)), ...created])
  }

  async function handleDeleteEntry(entryId: string) {
    await api.entries.delete(entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const loggedNonTags    = nonTags.filter(m => isLogged(m))
  const remainingNonTags = nonTags.filter(m => !isLogged(m) || m.allowMultiplePerDay)
  const loading = metricsLoading || entriesLoading

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">DailyTracker</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name ?? user?.email}</span>
          <button onClick={() => { clearAuth(); navigate('/login') }} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Date navigation */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Previous day"
            >
              ‹
            </button>

            {/* Clicking the date text opens the native date picker */}
            <div className="relative">
              <button
                onClick={() => datePickerRef.current?.showPicker?.() ?? datePickerRef.current?.focus()}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                {dateLabel}
                <span className="text-sm text-gray-400 font-normal">▾</span>
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                tabIndex={-1}
              />
            </div>

            <button
              onClick={goForward}
              disabled={isToday}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              ›
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : (
              <>
                {loggedNonTags.length}/{nonTags.length} metrics logged
                {!isToday && ' on this day'}
                {tags.length > 0 && ` · ${tagsLogged.size} tag${tagsLogged.size === 1 ? '' : 's'}`}
              </>
            )}
          </p>
        </div>

        {!loading && (
          <>
            {tags.length > 0 && (
              <TagPicker tags={tags} initiallySelected={tagsLogged} onSave={handleTagSave} />
            )}

            {remainingNonTags.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">To log</h3>
                <div className="space-y-2">
                  {remainingNonTags.map(metric => {
                    const val        = inlineValues[metric.id] ?? ''
                    const saving     = inlineSaving[metric.id]
                    const errMsg     = inlineErrors[metric.id]
                    const isText     = metric.type === 'TEXT' || metric.type === 'CATEGORICAL'
                    const isDur      = metric.type === 'DURATION'
                    const placeholder = isDur
                      ? 'e.g. 7h 22m'
                      : metric.type === 'SCALE'
                        ? `${metric.scaleMin ?? 1}–${metric.scaleMax ?? 10}`
                        : metric.unit ?? ''

                    return (
                      <div key={metric.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: metric.color ?? '#94a3b8' }} />
                          <Link to={`/metrics/${metric.id}`} className="flex-1 text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                            {metric.name}
                          </Link>
                          <div className="flex items-center gap-2">
                            <input
                              type={isText || isDur ? 'text' : 'number'}
                              step={isText || isDur ? undefined : 'any'}
                              min={metric.type === 'SCALE' ? (metric.scaleMin ?? 1) : undefined}
                              max={metric.type === 'SCALE' ? (metric.scaleMax ?? 10) : undefined}
                              value={val}
                              placeholder={placeholder}
                              onChange={e => setInlineValues(prev => ({ ...prev, [metric.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && handleInlineSave(metric)}
                              className={`border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isText || isDur ? 'w-28' : 'w-20 text-right'}`}
                            />
                            <button
                              onClick={() => handleInlineSave(metric)}
                              disabled={saving || !val.trim()}
                              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                            >
                              {saving ? '…' : '✓'}
                            </button>
                          </div>
                        </div>
                        {errMsg && <p className="text-xs text-red-500 mt-1.5 ml-6">{errMsg}</p>}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {loggedNonTags.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  {isToday ? 'Logged today' : 'Logged'}
                </h3>
                <div className="space-y-2">
                  {loggedNonTags.map(metric => {
                    const entry = entries.find(e => e.metricDefId === metric.id)
                    return (
                      <div key={metric.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                        <Link to={`/metrics/${metric.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: metric.color ?? '#94a3b8' }} />
                          <p className="text-sm font-medium text-gray-900 truncate">{metric.name}</p>
                          <span className="text-sm font-semibold text-gray-700 ml-auto">{entry ? displayValue(metric, entry) : ''}</span>
                          <span className="text-gray-300 flex-shrink-0">›</span>
                        </Link>
                        {entry && (
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            title="Clear entry"
                            className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {metrics.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No metrics yet.</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
