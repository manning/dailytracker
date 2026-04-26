import 'dotenv/config'
import { STARTER_METRICS } from './starterMetrics'

async function main() {
  console.log('Starter metrics are seeded per-user at registration — nothing to run here.')
  console.log('Defined metrics:', STARTER_METRICS.map((m) => m.name).join(', '))
}

main().catch(console.error)
