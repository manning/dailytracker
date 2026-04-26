import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, metricDefinitions } from '../db/schema'
import { STARTER_METRICS } from '../db/seed'

export const authRouter = Router()

const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().optional(),
})

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
})

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { email, password, name } = parsed.data

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({ email, passwordHash, name }).returning()
    await tx.insert(metricDefinitions).values(
      STARTER_METRICS.map((m) => ({ ...m, userId: newUser.id }))
    )
    return newUser
  })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' })
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})
