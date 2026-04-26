import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

export const chatRouter = Router()
chatRouter.use(requireAuth)

// Stub — LLM provider and implementation deferred
chatRouter.post('/', (_req, res) => {
  res.status(501).json({ error: 'LLM chat not yet implemented' })
})
