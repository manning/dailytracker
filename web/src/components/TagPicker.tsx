import { useEffect, useMemo, useState } from 'react'
import type { Metric } from '../lib/api'

interface Props {
  tags: Metric[]
  initiallySelected: Set<string>
  onSave: (selectedIds: Set<string>, deselectedIds: Set<string>) => Promise<void>
}

// Renders all of a user's boolean metrics as a single multi-select tag picker
// for the daily check-in. Default-on tags (defaultNumericValue=1) start
// pre-selected unless the user has explicitly toggled them today.
export default function TagPicker({ tags, initiallySelected, onSave }: Props) {
  const baseline = useMemo(() => {
    // Start from what's already logged today, plus any default-on tags
    // that haven't been explicitly handled yet.
    const set = new Set(initiallySelected)
    for (const t of tags) {
      if (t.defaultNumericValue === 1 && !initiallySelected.has(t.id)) {
        set.add(t.id)
      }
    }
    return set
  }, [tags, initiallySelected])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(baseline))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSelected(new Set(baseline))
    setDirty(false)
  }, [baseline])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const newlySelected   = new Set<string>()
      const newlyDeselected = new Set<string>()
      for (const t of tags) {
        const wasOn = initiallySelected.has(t.id)
        const isOn  = selected.has(t.id)
        if (isOn && !wasOn)  newlySelected.add(t.id)
        if (!isOn && wasOn) newlyDeselected.add(t.id)
      }
      await onSave(newlySelected, newlyDeselected)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  if (tags.length === 0) return null

  return (
    <section>
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Tags</h3>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => {
            const on = selected.has(tag.id)
            const color = tag.color ?? '#94a3b8'
            return (
              <button
                key={tag.id}
                onClick={() => toggle(tag.id)}
                className={`text-sm rounded-full px-3 py-1.5 font-medium border transition-colors flex items-center gap-1.5 ${
                  on
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
                style={on ? { backgroundColor: color } : undefined}
              >
                <span
                  className={`w-2 h-2 rounded-full ${on ? 'bg-white/80' : ''}`}
                  style={!on ? { backgroundColor: color } : undefined}
                />
                {tag.name}
              </button>
            )
          })}
        </div>
        {dirty && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save tags'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
