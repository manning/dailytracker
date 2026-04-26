import { Router } from 'express'
import { z } from 'zod'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { metricEntries, metricDefinitions } from '../db/schema'
import { requireAuth, AuthRequest } from '../middleware/auth'

export const entriesRouter = Router()
entriesRouter.use(requireAuth)

const entrySchema = z.object({
  metricDefId:  z.string().uuid(),
  numericValue: z.number().optional(),
  textValue:    z.string().optional(),
  loggedAt:     z.string().datetime(),
})

// List entries — optionally filter by metricDefId and/or date range
entriesRouter.get('/', async (req: AuthRequest, res) => {
  const { metricDefId, from, to } = req.query

  const conditions = [eq(metricEntries.userId, req.userId!)]
  if (metricDefId) conditions.push(eq(metricEntries.metricDefId, String(metricDefId)))
  if (from)        conditions.push(gte(metricEntries.loggedAt, new Date(String(from))))
  if (to)          conditions.push(lte(metricEntries.loggedAt, new Date(String(to))))

  const entries = await db.query.metricEntries.findMany({
    where: and(...conditions),
    orderBy: (t, { desc }) => desc(t.loggedAt),
    with: { metricDef: true },
  })
  res.json(entries)
})

// Create an entry
entriesRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = entrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { metricDefId, numericValue, textValue, loggedAt } = parsed.data

  const metric = await db.query.metricDefinitions.findFirst({
    where: eq(metricDefinitions.id, metricDefId),
  })
  if (!metric || metric.userId !== req.userId) {
    res.status(404).json({ error: 'Metric not found' })
    return
  }

  const [entry] = await db
    .insert(metricEntries)
    .values({
      userId: req.userId!,
      metricDefId,
      numericValue,
      textValue,
      loggedAt: new Date(loggedAt),
    })
    .returning()

  const full = await db.query.metricEntries.findFirst({
    where: eq(metricEntries.id, entry.id),
    with: { metricDef: true },
  })
  res.status(201).json(full)
})

// Delete an entry
entriesRouter.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await db.query.metricEntries.findFirst({
    where: eq(metricEntries.id, req.params.id),
  })
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await db.delete(metricEntries).where(eq(metricEntries.id, req.params.id))
  res.status(204).send()
})
