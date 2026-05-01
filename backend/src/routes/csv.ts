import { Router } from 'express'
import express from 'express'
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '../db'
import { metricDefinitions, metricEntries } from '../db/schema'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { parseCsvRows, csvCell } from '../lib/csv'
import { formatDuration, naturalUnitFromMetricUnit, parseDuration } from '../lib/duration'

export const csvRouter = Router()
csvRouter.use(requireAuth)

// ---------------------------------------------------------------------------
// GET /api/v1/csv   — export all entries as CSV
// Query params: from (ISO date), to (ISO date) — both optional
// ---------------------------------------------------------------------------
csvRouter.get('/', async (req: AuthRequest, res) => {
  const { from, to } = req.query

  const metrics = await db.query.metricDefinitions.findMany({
    where: and(eq(metricDefinitions.userId, req.userId!), isNull(metricDefinitions.archivedAt)),
    orderBy: (t, { asc }) => asc(t.order),
  })

  const booleanMetrics    = metrics.filter(m => m.type === 'BOOLEAN')
  const nonBooleanMetrics = metrics.filter(m => m.type !== 'BOOLEAN')
  const booleanById       = new Map(booleanMetrics.map(m => [m.id, m]))

  const conditions = [eq(metricEntries.userId, req.userId!)]
  if (from) conditions.push(gte(metricEntries.loggedAt, new Date(String(from))))
  if (to)   conditions.push(lte(metricEntries.loggedAt, new Date(String(to))))

  const entries = await db.query.metricEntries.findMany({
    where: and(...conditions),
    orderBy: (t, { asc }) => asc(t.loggedAt),
  })

  // Group by calendar date (UTC)
  const byDate = new Map<string, typeof entries>()
  for (const e of entries) {
    const date = e.loggedAt.toISOString().slice(0, 10)
    const bucket = byDate.get(date)
    if (bucket) bucket.push(e)
    else byDate.set(date, [e])
  }

  const dates = [...byDate.keys()].sort()

  // Header row
  const headerCols = ['date', ...nonBooleanMetrics.map(m => csvCell(m.name)), 'tags']
  const csvRows: string[] = [headerCols.join(',')]

  for (const date of dates) {
    const dayEntries = byDate.get(date)!
    const row: string[] = [date]

    for (const metric of nonBooleanMetrics) {
      const entry = dayEntries.find(e => e.metricDefId === metric.id)
      if (!entry) { row.push(''); continue }

      if (metric.type === 'DURATION' && entry.numericValue !== null) {
        row.push(csvCell(formatDuration(entry.numericValue, naturalUnitFromMetricUnit(metric.unit))))
      } else if (entry.numericValue !== null) {
        row.push(String(entry.numericValue))
      } else {
        row.push(csvCell(entry.textValue ?? ''))
      }
    }

    // Tags column: names sorted, pipes stripped
    const tagNames = dayEntries
      .filter(e => e.numericValue === 1 && booleanById.has(e.metricDefId))
      .map(e => booleanById.get(e.metricDefId)!.name.replace(/\|/g, ''))
      .sort()
    row.push(tagNames.join('|'))

    csvRows.push(row.join(','))
  }

  const filename = `dailytracker-${new Date().toISOString().slice(0, 10)}.csv`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csvRows.join('\r\n'))
})

// ---------------------------------------------------------------------------
// POST /api/v1/csv   — import CSV (Content-Type: text/csv)
// Returns { created, skipped, warnings }
// ---------------------------------------------------------------------------
csvRouter.post('/', express.text({ type: 'text/csv', limit: '10mb' }), async (req: AuthRequest, res) => {
  const csvText = req.body as string
  if (!csvText?.trim()) {
    res.status(400).json({ error: 'Empty CSV' }); return
  }

  const rows = parseCsvRows(csvText)
  if (rows.length < 2) {
    res.status(400).json({ error: 'CSV has no data rows' }); return
  }

  const header    = rows[0]
  const dataRows  = rows.slice(1)
  const dateColIdx = header.indexOf('date')
  const tagsColIdx = header.indexOf('tags')

  if (dateColIdx === -1) {
    res.status(400).json({ error: 'CSV must have a "date" column' }); return
  }

  // Load all metric definitions for this user (including archived, for matching)
  const metrics = await db.query.metricDefinitions.findMany({
    where: eq(metricDefinitions.userId, req.userId!),
  })
  // Case-insensitive name lookup
  const metricByName = new Map(metrics.map(m => [m.name.toLowerCase().trim(), m]))

  // Resolve each non-special column to a metric (null = unrecognised)
  const colMetric = header.map((col, i) => {
    if (i === dateColIdx || i === tagsColIdx) return null
    return metricByName.get(col.toLowerCase().trim()) ?? null
  })

  // Warn about unrecognised columns once
  const warnings: string[] = []
  for (let i = 0; i < header.length; i++) {
    if (i === dateColIdx || i === tagsColIdx) continue
    if (!colMetric[i]) warnings.push(`Column "${header[i]}" not found in your metrics — skipped`)
  }

  let created = 0
  let skipped = 0

  for (const row of dataRows) {
    const dateStr = row[dateColIdx]?.trim()
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

    const [y, m, d] = dateStr.split('-').map(Number)
    const loggedAt = new Date(y, m - 1, d, 12, 0, 0)
    const dayStart = new Date(y, m - 1, d, 0, 0, 0)
    const dayEnd   = new Date(y, m - 1, d, 23, 59, 59)

    // Fetch existing entries for idempotency check
    const existing = await db.query.metricEntries.findMany({
      where: and(
        eq(metricEntries.userId, req.userId!),
        gte(metricEntries.loggedAt, dayStart),
        lte(metricEntries.loggedAt, dayEnd),
      ),
    })
    const existingIds = new Set(existing.map(e => e.metricDefId))

    // Regular columns
    for (let i = 0; i < header.length; i++) {
      if (i === dateColIdx || i === tagsColIdx) continue
      const metric = colMetric[i]
      if (!metric) continue

      const cell = row[i]?.trim() ?? ''
      if (!cell) continue
      if (existingIds.has(metric.id)) { skipped++; continue }

      let numericValue: number | undefined
      let textValue: string | undefined

      if (metric.type === 'TEXT' || metric.type === 'CATEGORICAL') {
        textValue = cell
      } else if (metric.type === 'DURATION') {
        const seconds = parseDuration(cell, naturalUnitFromMetricUnit(metric.unit))
        if (seconds === null) {
          warnings.push(`Cannot parse duration "${cell}" for "${metric.name}" on ${dateStr}`)
          continue
        }
        numericValue = seconds
      } else if (metric.type === 'BOOLEAN') {
        if (cell !== '1') continue   // only log presence
        numericValue = 1
      } else {
        const n = parseFloat(cell)
        if (isNaN(n)) {
          warnings.push(`Invalid number "${cell}" for "${metric.name}" on ${dateStr}`)
          continue
        }
        numericValue = n
      }

      await db.insert(metricEntries).values({
        userId: req.userId!, metricDefId: metric.id,
        numericValue, textValue, loggedAt, source: 'MANUAL',
      })
      existingIds.add(metric.id)
      created++
    }

    // Tags column
    if (tagsColIdx !== -1) {
      const tagNames = (row[tagsColIdx] ?? '').split('|').map(t => t.trim()).filter(Boolean)
      for (const tagName of tagNames) {
        const metric = metricByName.get(tagName.toLowerCase().trim())
        if (!metric) {
          warnings.push(`Unknown tag "${tagName}" on ${dateStr} — skipped`)
          continue
        }
        if (metric.type !== 'BOOLEAN') {
          warnings.push(`Tag "${tagName}" is not a boolean metric — skipped`)
          continue
        }
        if (existingIds.has(metric.id)) { skipped++; continue }

        await db.insert(metricEntries).values({
          userId: req.userId!, metricDefId: metric.id,
          numericValue: 1, loggedAt, source: 'MANUAL',
        })
        existingIds.add(metric.id)
        created++
      }
    }
  }

  res.json({ created, skipped, warnings })
})
