import 'dotenv/config'
import { db } from './index'

export const STARTER_METRICS = [
  { name: 'Weight',     type: 'NUMBER'  as const, unit: 'lbs',   color: '#3b82f6', order: 0, allowMultiplePerDay: false },
  { name: 'Sleep',      type: 'NUMBER'  as const, unit: 'hours', color: '#8b5cf6', order: 1, allowMultiplePerDay: false },
  { name: 'Mood',       type: 'SCALE'   as const,                color: '#f59e0b', order: 2, allowMultiplePerDay: false },
  { name: 'Pain Level', type: 'SCALE'   as const,                color: '#ef4444', order: 3, allowMultiplePerDay: false },
  { name: 'Exercise',   type: 'BOOLEAN' as const,                color: '#10b981', order: 4, allowMultiplePerDay: true  },
]

async function main() {
  console.log('Starter metrics are seeded per-user at registration — nothing to run here.')
  await db.$client.end()
}

main().catch(console.error)
