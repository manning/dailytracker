// Duration parsing/formatting for DURATION metrics.
// Mirror of backend/src/lib/duration.ts — keep in sync. See that file for docs.

export type NaturalUnit = 'hours' | 'minutes' | 'seconds'

export function naturalUnitFromMetricUnit(unit: string | null | undefined): NaturalUnit {
  if (!unit) return 'minutes'
  const u = unit.trim().toLowerCase()
  if (u.startsWith('hour') || u === 'h' || u === 'hr' || u === 'hrs') return 'hours'
  if (u.startsWith('sec') || u === 's')                                return 'seconds'
  return 'minutes'
}

const COLON_RE  = /^[0-9]+(?:\.[0-9]+)?:[0-9]+(?:\.[0-9]+)?(?::[0-9]+(?:\.[0-9]+)?)?$/
const UNITS_RE  = /^(?:\s*([0-9]+(?:\.[0-9]+)?)\s*(?:hours?|hrs?|h)\b)?\s*(?:([0-9]+(?:\.[0-9]+)?)\s*(?:minutes?|mins?|m)\b)?\s*(?:([0-9]+(?:\.[0-9]+)?)\s*(?:seconds?|secs?|s)\b)?\s*$/i
const NUMBER_RE = /^[0-9]+(?:\.[0-9]+)?$/

export function parseDuration(input: string, naturalUnit: NaturalUnit = 'minutes'): number | null {
  const s = input.trim()
  if (!s) return null

  if (COLON_RE.test(s)) {
    const parts = s.split(':').map(Number)
    if (parts.some(Number.isNaN)) return null
    if (parts.length === 2) {
      const [m, sec] = parts
      return m * 60 + sec
    }
    const [h, m, sec] = parts
    return h * 3600 + m * 60 + sec
  }

  if (NUMBER_RE.test(s)) {
    const n = Number(s)
    if (naturalUnit === 'hours')   return n * 3600
    if (naturalUnit === 'seconds') return n
    return n * 60
  }

  const m = UNITS_RE.exec(s)
  if (m && (m[1] || m[2] || m[3])) {
    const h   = m[1] ? Number(m[1]) : 0
    const min = m[2] ? Number(m[2]) : 0
    const sec = m[3] ? Number(m[3]) : 0
    return h * 3600 + min * 60 + sec
  }

  return null
}

export function formatDuration(seconds: number, naturalUnit: NaturalUnit = 'minutes'): string {
  if (!Number.isFinite(seconds)) return ''
  const total = Math.max(0, Math.round(seconds))
  if (total === 0) {
    if (naturalUnit === 'hours')   return '0h'
    if (naturalUnit === 'seconds') return '0s'
    return '0m'
  }
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0) parts.push(`${s}s`)
  return parts.join(' ')
}
