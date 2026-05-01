import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { api, Metric, Entry } from '../../lib/api'
import { clearAuth } from '../../lib/auth'
import { parseDuration, formatDuration, naturalUnitFromMetricUnit } from '../../lib/duration'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dateLabel(d: Date): string {
  const today = new Date()
  const todayStr = formatDate(today)
  const dateStr = formatDate(d)
  if (dateStr === todayStr) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dateStr === formatDate(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayBounds(d: Date): { from: string; to: string } {
  const y = d.getFullYear(), mo = d.getMonth(), day = d.getDate()
  const from = new Date(y, mo, day, 0, 0, 0).toISOString()
  const to   = new Date(y, mo, day, 23, 59, 59).toISOString()
  return { from, to }
}

function loggedAtFor(d: Date): string {
  const today = new Date()
  if (formatDate(d) === formatDate(today)) return new Date().toISOString()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString()
}

function defaultInputFor(m: Metric): string {
  if (m.type === 'BOOLEAN') return '1'
  if (m.defaultNumericValue != null) {
    if (m.type === 'DURATION') {
      const nu = naturalUnitFromMetricUnit(m.unit)
      return formatDuration(m.defaultNumericValue, nu)
    }
    return String(m.defaultNumericValue)
  }
  if (m.defaultTextValue != null) return m.defaultTextValue
  return ''
}

export default function DashboardScreen() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  useFocusEffect(useCallback(() => {
    api.metrics.list().then(setMetrics).catch(console.error)
  }, []))

  const fetchEntries = useCallback(() => {
    const { from, to } = dayBounds(selectedDate)
    api.entries.list({ from, to }).then(setEntries).catch(console.error).finally(() => setLoading(false))
  }, [selectedDate])

  useEffect(() => {
    setLoading(true)
    fetchEntries()
  }, [fetchEntries])

  function shiftDate(days: number) {
    setSelectedDate(d => {
      const next = new Date(d)
      next.setDate(d.getDate() + days)
      return next
    })
  }

  const activeMetrics = metrics.filter(m => !m.archivedAt)
  const loggedIds = new Set(entries.map(e => e.metricDefId))

  const toLog = activeMetrics.filter(m => {
    if (m.type === 'BOOLEAN') return false
    if (m.allowMultiplePerDay) return true
    return !loggedIds.has(m.id)
  })

  const booleanMetrics = activeMetrics.filter(m => m.type === 'BOOLEAN')

  async function handleSubmit(metric: Metric) {
    const raw = (inputValues[metric.id] ?? defaultInputFor(metric)).trim()
    let numericValue: number | undefined
    let textValue: string | undefined

    if (metric.type === 'DURATION') {
      const nu = naturalUnitFromMetricUnit(metric.unit)
      const secs = parseDuration(raw, nu)
      if (secs == null) {
        Alert.alert('Invalid duration', 'Try "7h 22m" or "45m" or "1:30"')
        return
      }
      numericValue = secs
    } else if (metric.type === 'TEXT' || metric.type === 'CATEGORICAL') {
      if (!raw) return
      textValue = raw
    } else {
      const n = Number(raw)
      if (!raw || Number.isNaN(n)) return
      numericValue = n
    }

    setSubmitting(s => ({ ...s, [metric.id]: true }))
    try {
      const loggedAt = loggedAtFor(selectedDate)
      await api.entries.create({ metricDefId: metric.id, numericValue, textValue, loggedAt })
      setInputValues(v => ({ ...v, [metric.id]: '' }))
      fetchEntries()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to log entry')
    } finally {
      setSubmitting(s => ({ ...s, [metric.id]: false }))
    }
  }

  async function handleDelete(entry: Entry) {
    try {
      await api.entries.delete(entry.id)
      fetchEntries()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  async function toggleBoolean(metric: Metric) {
    const existing = entries.find(e => e.metricDefId === metric.id)
    if (existing) {
      await handleDelete(existing)
    } else {
      try {
        await api.entries.create({ metricDefId: metric.id, numericValue: 1, loggedAt: loggedAtFor(selectedDate) })
        fetchEntries()
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to log entry')
      }
    }
  }

  function entryDisplay(entry: Entry, metric: Metric): string {
    if (metric.type === 'DURATION' && entry.numericValue != null) {
      return formatDuration(entry.numericValue, naturalUnitFromMetricUnit(metric.unit))
    }
    if (entry.numericValue != null) return String(entry.numericValue)
    return entry.textValue ?? ''
  }

  async function handleLogout() {
    await clearAuth()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.appTitle}>DailyTracker</Text>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={() => router.push('/manage')} style={s.headerLink}>
            <Text style={s.headerLinkText}>Manage</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.headerLink}>
            <Text style={s.headerLinkText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date navigation */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={() => shiftDate(-1)} style={s.navBtn}>
          <Text style={s.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.dateLabel}>{dateLabel(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => shiftDate(1)}
          style={s.navBtn}
          disabled={formatDate(selectedDate) >= formatDate(new Date())}
        >
          <Text style={[s.navBtnText, formatDate(selectedDate) >= formatDate(new Date()) && s.navBtnDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* To log */}
            {toLog.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>To log</Text>
                {toLog.map(metric => (
                  <MetricInputRow
                    key={metric.id}
                    metric={metric}
                    value={inputValues[metric.id] ?? ''}
                    onChangeValue={v => setInputValues(vals => ({ ...vals, [metric.id]: v }))}
                    onSubmit={() => handleSubmit(metric)}
                    submitting={!!submitting[metric.id]}
                    onNavigate={() => router.push(`/metrics/${metric.id}`)}
                  />
                ))}
              </View>
            )}

            {/* Logged today */}
            {entries.filter(e => {
              const m = metrics.find(m => m.id === e.metricDefId)
              return m && m.type !== 'BOOLEAN'
            }).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Logged</Text>
                {entries.filter(e => {
                  const m = metrics.find(m => m.id === e.metricDefId)
                  return m && m.type !== 'BOOLEAN'
                }).map(entry => {
                  const metric = metrics.find(m => m.id === entry.metricDefId)!
                  return (
                    <View key={entry.id} style={s.loggedRow}>
                      <TouchableOpacity onPress={() => router.push(`/metrics/${metric.id}`)} style={s.loggedName}>
                        <Text style={s.loggedNameText}>{metric.name}</Text>
                      </TouchableOpacity>
                      <Text style={s.loggedValue}>{entryDisplay(entry, metric)}</Text>
                      <TouchableOpacity onPress={() => handleDelete(entry)} style={s.deleteBtn}>
                        <Text style={s.deleteBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Boolean tags */}
            {booleanMetrics.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Tags</Text>
                <View style={s.tagGrid}>
                  {booleanMetrics.map(metric => {
                    const logged = loggedIds.has(metric.id)
                    return (
                      <TouchableOpacity
                        key={metric.id}
                        style={[s.tag, logged && s.tagActive]}
                        onPress={() => toggleBoolean(metric)}
                      >
                        <Text style={[s.tagText, logged && s.tagTextActive]}>{metric.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

interface MetricInputRowProps {
  metric: Metric
  value: string
  onChangeValue: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  onNavigate: () => void
}

function MetricInputRow({ metric, value, onChangeValue, onSubmit, submitting, onNavigate }: MetricInputRowProps) {
  const placeholder = (() => {
    if (metric.type === 'DURATION') {
      const nu = naturalUnitFromMetricUnit(metric.unit)
      return nu === 'hours' ? 'e.g. 7h 30m' : nu === 'seconds' ? 'e.g. 45s' : 'e.g. 30m'
    }
    if (metric.type === 'SCALE') {
      const lo = metric.scaleMin ?? 0
      const hi = metric.scaleMax ?? 10
      return `${lo}–${hi}`
    }
    if (metric.unit) return metric.unit
    return 'Value'
  })()

  const keyboardType = (() => {
    if (metric.type === 'TEXT' || metric.type === 'CATEGORICAL') return 'default'
    return 'decimal-pad'
  })()

  return (
    <View style={s.inputRow}>
      <TouchableOpacity onPress={onNavigate} style={s.inputMetricName}>
        <Text style={s.inputMetricNameText}>{metric.name}</Text>
      </TouchableOpacity>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeValue}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity style={s.submitBtn} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.submitBtnText}>✓</Text>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#f8fafc' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  appTitle:        { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerActions:   { flexDirection: 'row', gap: 12 },
  headerLink:      { paddingVertical: 4 },
  headerLinkText:  { fontSize: 14, color: '#6b7280' },
  dateNav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 16 },
  navBtn:          { padding: 8 },
  navBtnText:      { fontSize: 24, color: '#2563eb', fontWeight: '600' },
  navBtnDisabled:  { color: '#d1d5db' },
  dateLabel:       { fontSize: 17, fontWeight: '600', color: '#111827', minWidth: 100, textAlign: 'center' },
  scroll:          { flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 40 },
  section:         { marginBottom: 24 },
  sectionTitle:    { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  inputMetricName: { flex: 1 },
  inputMetricNameText: { fontSize: 15, color: '#1d4ed8', fontWeight: '500' },
  input:           { width: 90, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#111827', textAlign: 'right', marginRight: 8 },
  submitBtn:       { backgroundColor: '#2563eb', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  submitBtnText:   { color: '#fff', fontSize: 18, fontWeight: '600' },
  loggedRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  loggedName:      { flex: 1 },
  loggedNameText:  { fontSize: 15, color: '#1d4ed8', fontWeight: '500' },
  loggedValue:     { fontSize: 15, color: '#111827', fontWeight: '600', marginRight: 12 },
  deleteBtn:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#f3f4f6' },
  deleteBtnText:   { fontSize: 18, color: '#6b7280', lineHeight: 22 },
  tagGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:             { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  tagActive:       { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  tagText:         { fontSize: 14, color: '#374151' },
  tagTextActive:   { color: '#2563eb', fontWeight: '600' },
})
