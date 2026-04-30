import { Router } from 'express'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db'
import { metricDefinitions } from '../db/schema'
import { requireAuth, AuthRequest } from '../middleware/auth'

export const metricsRouter = Router()
metricsRouter.use(requireAuth)

const metricTypeValues = ['NUMBER', 'SCALE', 'BOOLEAN', 'DURATION', 'CATEGORICAL', 'TEXT'] as const

const metricSchema = z.object({
  name:                z.string().min(1),
  type:                z.enum(metricTypeValues),
  unit:                z.string().optional(),
  color:               z.string().optional(),
  order:               z.number().int().optional(),
  allowMultiplePerDay: z.boolean().optional(),
  scaleMin:            z.number().int().nullable().optional(),
  scaleMax:            z.number().int().nullable().optional(),
  defaultNumericValue: z.number().nullable().optional(),
  defaultTextValue:    z.string().nullable().optional(),
})

// List all active metrics for the authenticated user
metricsRouter.get('/', async (req: AuthRequest, res) => {
  const metrics = await db.query.metricDefinitions.findMany({
    where: and(
      eq(metricDefinitions.userId, req.userId!),
      isNull(metricDefinitions.archivedAt)
    ),
    orderBy: (t, { asc }) => asc(t.order),
  })
  res.json(metrics)
})

// Create a new metric
metricsRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = metricSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const [metric] = await db
    .insert(metricDefinitions)
    .values({ ...parsed.data, userId: req.userId! })
    .returning()
  res.status(201).json(metric)
})

// Update a metric
metricsRouter.patch('/:id', async (req: AuthRequest, res) => {
  const parsed = metricSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const existing = await db.query.metricDefinitions.findFirst({
    where: eq(metricDefinitions.id, req.params.id),
  })
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const [updated] = await db
    .update(metricDefinitions)
    .set(parsed.data)
    .where(eq(metricDefinitions.id, req.params.id))
    .returning()
  res.json(updated)
})

// Archive a metric (soft delete)
metricsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await db.query.metricDefinitions.findFirst({
    where: eq(metricDefinitions.id, req.params.id),
  })
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await db
    .update(metricDefinitions)
    .set({ archivedAt: new Date() })
    .where(eq(metricDefinitions.id, req.params.id))
  res.status(204).send()
})
