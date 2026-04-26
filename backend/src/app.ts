import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth'
import { metricsRouter } from './routes/metrics'
import { entriesRouter } from './routes/entries'
import { chatRouter } from './routes/chat'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/metrics', metricsRouter)
app.use('/api/v1/entries', entriesRouter)
app.use('/api/v1/chat', chatRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})
