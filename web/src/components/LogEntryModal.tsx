import { useState, FormEvent } from 'react'
import type { Metric } from '../lib/api'

interface Props {
  metric: Metric
  onSave: (value: number | string, loggedAt: string) => Promise<void>
  onClose: () => void
}

export default function LogEntryModal({ metric, onSave, onClose }: Props) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const parsed = metric.type === 'TEXT' ? value : parseFloat(value)
      if (metric.type !== 'TEXT' && isNaN(parsed as number)) {
        throw new Error('Please enter a valid number')
      }
      await onSave(parsed, new Date(date).toISOString())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const inputLabel = () => {
    if (metric.type === 'BOOLEAN') return 'Value (1 = yes, 0 = no)'
    if (metric.type === 'SCALE') return 'Scale (1–10)'
    if (metric.type === 'TEXT') return 'Note'
    return `Value${metric.unit ? ` (${metric.unit})` : ''}`
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Log {metric.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{inputLabel()}</label>
            {metric.type === 'TEXT' ? (
              <textarea
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            ) : (
              <input
                type="number"
                step="any"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; time</label>
            <input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
