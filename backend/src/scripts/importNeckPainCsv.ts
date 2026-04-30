// Imports data/neck-pain-2026-cleaned.csv into the dailytracker schema.
//
// Usage:
//   tsx src/scripts/importNeckPainCsv.ts --user <userId> --csv <path> [--time HH:MM] [--dry-run]
//
// The script is idempotent in spirit but not enforced: it skips creating a
// metric definition that already exists (matched by name within the user) and
// skips inserting an entry that already exists for the same (metricDef, day).
//
// Open questions still flagged for the user — see the comments on the relevant
// COLUMN_MAP entries. Defaults reflect best guesses; rerun after correcting.

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { and, eq, gte, lt } from 'drizzle-orm'
import { db } from '../db'
import { metricDefinitions, metricEntries } from '../db/schema'

// ---- CLI parsing -----------------------------------------------------------

function getArg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  return process.argv[i + 1]
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

// ---- Tiny CSV parser (handles double-quoted fields with embedded commas) ---

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// ---- Column → metric definition mapping -----------------------------------

type MetricSpec = {
  name: string
  type: 'NUMBER' | 'SCALE' | 'BOOLEAN' | 'DURATION' | 'CATEGORICAL' | 'TEXT'
  unit?: string
  color?: string
  order: number
  allowMultiplePerDay?: boolean
  scaleMin?: number
  scaleMax?: number
}

// Each entry maps a CSV column to a single metric. Special handling for the
// `tags` column (multi-valued, fan-out) and the bicycle pair lives further
// down — not in this list.
const COLUMN_MAP: { csv: string; metric: MetricSpec; mapCell: (raw: string) => { numericValue?: number; textValue?: string } | null }[] = [
  {
    csv: 'pillow',
    metric: { name: 'Pillow', type: 'CATEGORICAL', order: 10 },
    mapCell: (raw) => raw.trim() === '' ? null : { textValue: raw.trim() },
  },
  {
    csv: 'pain_on_waking',
    metric: { name: 'Pain on Waking', type: 'SCALE', color: '#fb923c', order: 20, scaleMin: 0, scaleMax: 10 },
    mapCell: numberCell,
  },
  {
    csv: 'max_daytime_pain',
    metric: { name: 'Max Daytime Pain', type: 'SCALE', color: '#ef4444', order: 21, scaleMin: 0, scaleMax: 10 },
    mapCell: numberCell,
  },
  {
    // QUESTION: this is a 0–100 sleep *score* (Garmin/Oura-style), not hours.
    // Modelled as a separate metric from the starter "Sleep" (DURATION/hours).
    // Confirm naming + unit on review.
    csv: 'prev_night_sleep',
    metric: { name: 'Sleep Score', type: 'NUMBER', unit: '/100', color: '#8b5cf6', order: 30 },
    mapCell: numberCell,
  },
  // Activity / exercise booleans (insert entry only when value === 1)
  { csv: 'strength_training',   metric: { name: 'Strength Training',  type: 'BOOLEAN', color: '#10b981', order: 40 }, mapCell: boolCell },
  { csv: 'hike',                metric: { name: 'Hike',               type: 'BOOLEAN', color: '#16a34a', order: 41 }, mapCell: boolCell },
  { csv: 'cycling_around_town', metric: { name: 'Cycling around Town', type: 'BOOLEAN', color: '#0ea5e9', order: 42 }, mapCell: boolCell },
  // exercise_bicycle + exercise_bicycle_mins are handled as a pair below.
  { csv: 'dish_walk',           metric: { name: 'Dish Walk',          type: 'BOOLEAN', color: '#22c55e', order: 44 }, mapCell: boolCell },
  { csv: 'yoga',                metric: { name: 'Yoga',               type: 'BOOLEAN', color: '#a855f7', order: 45 }, mapCell: boolCell },
  // QUESTION: "ghokale" in the CSV is a misspelling of the Gokhale Method
  // (Esther Gokhale). Saving under the corrected name; revert if intentional.
  { csv: 'ghokale_abs',         metric: { name: 'Gokhale Abs',        type: 'BOOLEAN', color: '#ec4899', order: 50 }, mapCell: boolCell },
  { csv: 'ghokale_cardio',      metric: { name: 'Gokhale Cardio',     type: 'BOOLEAN', color: '#ec4899', order: 51 }, mapCell: boolCell },
  { csv: 'ghokale_legs',        metric: { name: 'Gokhale Legs',       type: 'BOOLEAN', color: '#ec4899', order: 52 }, mapCell: boolCell },
  { csv: 'ghokale_glutes',      metric: { name: 'Gokhale Glutes',     type: 'BOOLEAN', color: '#ec4899', order: 53 }, mapCell: boolCell },
  { csv: 'juggling',            metric: { name: 'Juggling',           type: 'BOOLEAN', color: '#f59e0b', order: 60 }, mapCell: boolCell },
  { csv: 'neck_pt',             metric: { name: 'Neck PT',            type: 'BOOLEAN', color: '#ef4444', order: 61 }, mapCell: boolCell },
  // Medications: doseable ones as NUMBER (count of doses); supplements as BOOLEAN.
  { csv: 'tylenol',             metric: { name: 'Tylenol',  type: 'NUMBER', unit: 'doses', color: '#64748b', order: 70 }, mapCell: numberCell },
  { csv: 'advil',               metric: { name: 'Advil',    type: 'NUMBER', unit: 'doses', color: '#64748b', order: 71 }, mapCell: numberCell },
  { csv: 'celebrex',            metric: { name: 'Celebrex', type: 'NUMBER', unit: 'doses', color: '#64748b', order: 72 }, mapCell: numberCell },
  { csv: 'curcumin',            metric: { name: 'Curcumin',      type: 'BOOLEAN', color: '#fbbf24', order: 80 }, mapCell: boolCell },
  { csv: 'cbd_overnight',       metric: { name: 'CBD Overnight', type: 'BOOLEAN', color: '#84cc16', order: 81 }, mapCell: boolCell },
  { csv: 'omega_3',             metric: { name: 'Omega-3',       type: 'BOOLEAN', color: '#0ea5e9', order: 82 }, mapCell: boolCell },
  // Free text journal — one TEXT metric per day.
  {
    csv: 'notes',
    metric: { name: 'Notes', type: 'TEXT', order: 90 },
    mapCell: (raw) => raw.trim() === '' ? null : { textValue: raw.trim() },
  },
]

function numberCell(raw: string): { numericValue: number } | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? { numericValue: n } : null
}

function boolCell(raw: string): { numericValue: number } | null {
  // Per the PRD tag model: only insert an entry when the activity happened.
  // 0 and '' both result in no entry.
  return raw.trim() === '1' ? { numericValue: 1 } : null
}

// QUESTION: 2 of the 10 days where exercise_bicycle=1 have an empty mins
// column. Storing those with numericValue=null (= "happened, duration unknown")
// rather than guessing or skipping. Confirm preferred behaviour.
const BICYCLE_METRIC: MetricSpec = {
  name: 'Exercise Bicycle',
  type: 'DURATION',
  unit: 'minutes',
  color: '#0284c7',
  order: 43,
}

// Tag definition for the multi-valued `tags` column. Each unique tag becomes
// its own BOOLEAN metric; entries are inserted per-day per-tag.
const TAG_METRIC_DEFAULTS: Omit<MetricSpec, 'name' | 'order'> = {
  type: 'BOOLEAN',
  color: '#94a3b8',
}
function humanizeTag(slug: string): string {
  const titled = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  // Keep clinical acronyms uppercase to match column-derived names like "Neck PT".
  return titled.replace(/\bPt\b/g, 'PT').replace(/\bCbd\b/g, 'CBD')
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const userId = getArg('user')
  const csvPath = getArg('csv')
  const timeOfDay = getArg('time', '12:00')!
  const dryRun = hasFlag('dry-run')

  if (!userId || !csvPath) {
    console.error('Usage: tsx src/scripts/importNeckPainCsv.ts --user <userId> --csv <path> [--time HH:MM] [--dry-run]')
    process.exit(1)
  }
  if (!/^\d{2}:\d{2}$/.test(timeOfDay)) {
    console.error(`--time must be HH:MM, got ${timeOfDay}`)
    process.exit(1)
  }

  const text = readFileSync(csvPath, 'utf8')
  const rows = parseCsv(text)
  const header = rows.shift()
  if (!header) { console.error('Empty CSV'); process.exit(1) }
  const colIndex = (col: string) => {
    const i = header.indexOf(col)
    if (i === -1) throw new Error(`CSV missing column ${col}`)
    return i
  }
  const records = rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) as Record<string, string>[]

  // Collect distinct tags for the `tags` column.
  const tagsCol = colIndex('tags')
  const distinctTags = new Set<string>()
  for (const r of rows) {
    for (const t of r[tagsCol].split('|').map(s => s.trim()).filter(Boolean)) {
      distinctTags.add(t)
    }
  }

  // ---- Ensure metric definitions exist (per-user) -------------------------

  const existingDefs = dryRun
    ? []
    : await db.query.metricDefinitions.findMany({ where: eq(metricDefinitions.userId, userId) })
  const defByName = new Map(existingDefs.map(d => [d.name, d]))

  async function ensureDef(spec: MetricSpec): Promise<string> {
    const found = defByName.get(spec.name)
    if (found) return found.id
    if (dryRun) {
      console.log(`[dry-run] CREATE metric "${spec.name}" (${spec.type}${spec.unit ? `, ${spec.unit}` : ''})`)
      return `dry-${spec.name}`
    }
    const [row] = await db.insert(metricDefinitions).values({
      userId: userId!,
      name: spec.name,
      type: spec.type,
      unit: spec.unit,
      color: spec.color,
      order: spec.order,
      allowMultiplePerDay: spec.allowMultiplePerDay ?? false,
      scaleMin: spec.scaleMin,
      scaleMax: spec.scaleMax,
    }).returning()
    defByName.set(row.name, row)
    return row.id
  }

  const colDefIds: Record<string, string> = {}
  for (const m of COLUMN_MAP) colDefIds[m.csv] = await ensureDef(m.metric)
  const bicycleDefId = await ensureDef(BICYCLE_METRIC)

  const tagDefIds: Record<string, string> = {}
  let tagOrder = 100
  for (const slug of distinctTags) {
    tagDefIds[slug] = await ensureDef({
      name: humanizeTag(slug),
      ...TAG_METRIC_DEFAULTS,
      order: tagOrder++,
    })
  }

  // ---- Insert entries ------------------------------------------------------

  let inserted = 0
  let skippedDuplicate = 0

  async function insertEntry(metricDefId: string, dayIso: string, value: { numericValue?: number; textValue?: string }) {
    const loggedAt = new Date(`${dayIso}T${timeOfDay}:00.000Z`)
    if (dryRun) { inserted++; return }

    // Idempotency: skip if an entry already exists for this metric on this day.
    const dayStart = new Date(`${dayIso}T00:00:00.000Z`)
    const dayEnd   = new Date(`${dayIso}T00:00:00.000Z`); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
    const existing = await db.query.metricEntries.findFirst({
      where: and(
        eq(metricEntries.userId, userId!),
        eq(metricEntries.metricDefId, metricDefId),
        gte(metricEntries.loggedAt, dayStart),
        lt(metricEntries.loggedAt, dayEnd),
      ),
    })
    if (existing) { skippedDuplicate++; return }

    await db.insert(metricEntries).values({
      userId: userId!,
      metricDefId,
      numericValue: value.numericValue,
      textValue: value.textValue,
      loggedAt,
    })
    inserted++
  }

  for (const rec of records) {
    const day = rec.date
    if (!day) continue

    for (const m of COLUMN_MAP) {
      const v = m.mapCell(rec[m.csv] ?? '')
      if (v) await insertEntry(colDefIds[m.csv], day, v)
    }

    // exercise_bicycle pair → DURATION (minutes)
    if ((rec['exercise_bicycle'] ?? '').trim() === '1') {
      const minsRaw = (rec['exercise_bicycle_mins'] ?? '').trim()
      const mins = minsRaw === '' ? null : Number(minsRaw)
      const seconds = mins !== null && Number.isFinite(mins) ? mins * 60 : null
      // Note: schema allows numericValue to be null. Storing null = "rode bike,
      // duration unrecorded". See QUESTION above.
      await insertEntry(bicycleDefId, day, seconds === null ? {} : { numericValue: seconds })
    }

    // tags column → fan out to per-tag boolean entries
    const tags = (rec['tags'] ?? '').split('|').map(s => s.trim()).filter(Boolean)
    for (const t of tags) {
      await insertEntry(tagDefIds[t], day, { numericValue: 1 })
    }
  }

  console.log(`Done. inserted=${inserted} skippedDuplicate=${skippedDuplicate} ${dryRun ? '(dry-run)' : ''}`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
