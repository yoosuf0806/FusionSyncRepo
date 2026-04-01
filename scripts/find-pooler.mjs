import pg from 'pg'
const { Client } = pg

// Try all known Supabase pooler regions
const regions = [
  'aws-0-ap-southeast-1',
  'aws-0-ap-southeast-2',
  'aws-0-ap-northeast-1',
  'aws-0-us-east-1',
  'aws-0-us-west-1',
  'aws-0-eu-central-1',
  'aws-0-eu-west-1',
  'aws-0-eu-west-2',
  'aws-0-sa-east-1',
]

async function tryPooler(region, port) {
  const host = `${region}.pooler.supabase.com`
  const client = new Client({
    host, port,
    user: 'postgres.asusrhebwmictwzrbumr',
    password: 'HelpingHands@123',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    const r = await client.query('SELECT current_database()')
    console.log(`✅ CONNECTED: ${host}:${port} → db=${r.rows[0].current_database}`)
    return client
  } catch (e) {
    const short = e.message.substring(0, 60)
    console.log(`  ✗ ${region}:${port} — ${short}`)
    try { await client.end() } catch {}
    return null
  }
}

for (const region of regions) {
  const c = await tryPooler(region, 5432)
  if (c) { await c.end(); process.exit(0) }
}
console.log('\nNo pooler connected.')
