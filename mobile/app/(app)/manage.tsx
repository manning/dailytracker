import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, Alert, Switch, SafeAreaView, ActivityIndicator,
} from 'react-native'
import { api, Metric, MetricType } from '../../lib/api'
import { parseDuration, formatDuration, naturalUnitFromMetricUnit } from '../../lib/duration'

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
    name: m.name,
    type: m.type,
    unit: m.unit ?? '',
    color: m.color ?? '#2563eb',
    allowMultiplePerDay: m.allowMultiplePerDay,
    scaleMin: m.scaleMin != null ? String(m.scaleMin) : '0',
    scaleMax: m.scaleMax != null ? String(m.scaleMax) : '10',
    defaultValue,
  }
}

export default function ManageScreen() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const all = await api.metrics.list()
      setMetrics(all)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingId(null)
    setForm(blankForm())
    setShowForm(true)
  }

  function openEdit(m: Metric) {
    setEditingId(m.id)
    setForm(formFromMetric(m))
    setShowForm(true)
  }

  function handleArchive(m: Metric) {
    Alert.alert(
      'Remove metric',
      `Archive "${m.name}"? Your history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            await api.metrics.archive(m.id)
            load()
          },
        },
      ],
    )
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert('Name is required'); return }
    setSaving(true)
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof FormState) => (val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }))

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Metrics</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {metrics.length === 0 && (
            <Text style={s.empty}>No metrics yet. Tap "+ Add" to create one.</Text>
          )}
          {metrics.map(m => (
            <View key={m.id} style={s.row}>
              <View style={[s.colorDot, { backgroundColor: m.color ?? '#64748b' }]} />
              <View style={s.rowInfo}>
                <Text style={s.rowName}>{m.name}</Text>
                <Text style={s.rowMeta}>
                  {TYPE_LABELS[m.type]}
                  {m.unit ? ` · ${m.unit}` : ''}
                  {m.type === 'SCALE' ? ` · ${m.scaleMin ?? 0}–${m.scaleMax ?? 10}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(m)} style={s.iconBtn}>
                <Text style={s.iconText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleArchive(m)} style={s.iconBtn}>
                <Text style={s.iconText}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editingId ? 'Edit Metric' : 'New Metric'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" /> : <Text style={s.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Name</Text>
            <TextInput
              style={s.input} value={form.name} onChangeText={set('name')}
              placeholder="e.g. Weight" autoFocus
            />

            {!editingId && (
              <>
                <Text style={s.label}>Type</Text>
                <View style={s.chipRow}>
                  {TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.chip, form.type === t && s.chipActive]}
                      onPress={() => set('type')(t)}
                    >
                      <Text style={[s.chipText, form.type === t && s.chipTextActive]}>
                        {TYPE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {['NUMBER', 'DURATION'].includes(form.type) && (
              <>
                <Text style={s.label}>Unit (optional)</Text>
                <TextInput
                  style={s.input} value={form.unit} onChangeText={set('unit')}
                  placeholder={form.type === 'DURATION' ? 'hours, minutes…' : 'lbs, km, reps…'}
                />
              </>
            )}

            {form.type === 'SCALE' && (
              <>
                <Text style={s.label}>Scale range</Text>
                <View style={s.rangeRow}>
                  <TextInput
                    style={[s.input, s.rangeInput]} value={form.scaleMin}
                    onChangeText={set('scaleMin')} placeholder="Min" keyboardType="numeric"
                  />
                  <Text style={s.rangeSep}>–</Text>
                  <TextInput
                    style={[s.input, s.rangeInput]} value={form.scaleMax}
                    onChangeText={set('scaleMax')} placeholder="Max" keyboardType="numeric"
                  />
                </View>
              </>
            )}

            {form.type !== 'BOOLEAN' && (
              <>
                <Text style={s.label}>Default value (optional)</Text>
                <TextInput
                  style={s.input} value={form.defaultValue} onChangeText={set('defaultValue')}
                  placeholder={
                    form.type === 'DURATION' ? 'e.g. 7h 30m' :
                    form.type === 'SCALE'    ? `${form.scaleMin}–${form.scaleMax}` :
                    form.type === 'TEXT' || form.type === 'CATEGORICAL' ? 'Default text' :
                    'Number'
                  }
                  keyboardType={['TEXT', 'CATEGORICAL', 'DURATION'].includes(form.type) ? 'default' : 'decimal-pad'}
                />
              </>
            )}

            <Text style={s.label}>Color</Text>
            <View style={s.colorRow}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.swatch, { backgroundColor: c }, form.color === c && s.swatchSelected]}
                  onPress={() => set('color')(c)}
                />
              ))}
            </View>

            {form.type !== 'BOOLEAN' && (
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Allow multiple entries per day</Text>
                <Switch
                  value={form.allowMultiplePerDay}
                  onValueChange={v => set('allowMultiplePerDay')(v)}
                  trackColor={{ true: '#2563eb' }}
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f8fafc' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title:         { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn:        { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:    { color: '#fff', fontWeight: '600', fontSize: 14 },
  list:          { padding: 16, paddingBottom: 40 },
  empty:         { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  colorDot:      { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowInfo:       { flex: 1 },
  rowName:       { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowMeta:       { fontSize: 12, color: '#6b7280', marginTop: 2 },
  iconBtn:       { padding: 6, marginLeft: 4 },
  iconText:      { fontSize: 16 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle:    { fontSize: 17, fontWeight: '600', color: '#111827' },
  cancelText:    { fontSize: 16, color: '#6b7280' },
  saveText:      { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  formContent:   { padding: 16, paddingBottom: 60 },
  label:         { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  input:         { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#fff' },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive:    { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  chipText:      { fontSize: 13, color: '#374151' },
  chipTextActive:{ color: '#2563eb', fontWeight: '600' },
  rangeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput:    { flex: 1 },
  rangeSep:      { fontSize: 18, color: '#6b7280' },
  colorRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  swatch:        { width: 32, height: 32, borderRadius: 16 },
  swatchSelected:{ borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  switchRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  switchLabel:   { fontSize: 15, color: '#111827', flex: 1 },
})
