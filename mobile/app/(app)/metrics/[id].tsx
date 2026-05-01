import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, SafeAreaView,
} from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { api, Entry, Metric } from '../../../lib/api'
import { formatDuration, naturalUnitFromMetricUnit } from '../../../lib/duration'

function entryDisplay(entry: Entry, metric: Metric): string {
  if (metric.type === 'DURATION' && entry.numericValue != null) {
    return formatDuration(entry.numericValue, naturalUnitFromMetricUnit(metric.unit))
  }
  if (entry.numericValue != null) return String(entry.numericValue)
  return entry.textValue ?? ''
}

function formatEntryDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function MetricDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const [metric, setMetric] = useState<Metric | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [allMetrics, allEntries] = await Promise.all([
          api.metrics.list(),
          api.entries.list({ metricDefId: id }),
        ])
        const m = allMetrics.find(m => m.id === id) ?? null
        setMetric(m)
        if (m) navigation.setOptions({ headerTitle: m.name, headerShown: true })
        setEntries(allEntries.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)))
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleDelete(entry: Entry) {
    try {
      await api.entries.delete(entry.id)
      setEntries(es => es.filter(e => e.id !== entry.id))
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!metric) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.errorText}>Metric not found</Text>
      </SafeAreaView>
    )
  }

  const recentEntries = entries.slice(0, 90)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.statRow}>
          <StatCard label="Total entries" value={String(entries.length)} />
          {entries.length > 0 && metric.type !== 'TEXT' && metric.type !== 'CATEGORICAL' && metric.type !== 'BOOLEAN' && (
            <>
              <StatCard
                label="Latest"
                value={entryDisplay(entries[0], metric)}
              />
            </>
          )}
        </View>

        <Text style={s.sectionTitle}>History</Text>
        {recentEntries.length === 0 ? (
          <Text style={s.emptyText}>No entries yet</Text>
        ) : (
          recentEntries.map(entry => (
            <View key={entry.id} style={s.entryRow}>
              <View style={s.entryInfo}>
                <Text style={s.entryValue}>{entryDisplay(entry, metric)}</Text>
                <Text style={s.entryDate}>{formatEntryDate(entry.loggedAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(entry)} style={s.deleteBtn}>
                <Text style={s.deleteBtnText}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f8fafc' },
  content:      { padding: 16, paddingBottom: 40 },
  statRow:      { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statValue:    { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 4 },
  statLabel:    { fontSize: 12, color: '#6b7280' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  entryRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  entryInfo:    { flex: 1 },
  entryValue:   { fontSize: 16, fontWeight: '600', color: '#111827' },
  entryDate:    { fontSize: 12, color: '#6b7280', marginTop: 2 },
  deleteBtn:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#f3f4f6' },
  deleteBtnText:{ fontSize: 18, color: '#6b7280', lineHeight: 22 },
  errorText:    { textAlign: 'center', marginTop: 60, color: '#6b7280', fontSize: 16 },
  emptyText:    { textAlign: 'center', color: '#9ca3af', marginTop: 20 },
})
