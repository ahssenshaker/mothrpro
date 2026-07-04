/**
 * Migration script: extracts influencer data from the legacy __d__ JSON blob
 * inside index.html and inserts it into the Supabase `influencers` table.
 *
 * Run ONCE before deploying the new version:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/extract-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Validate env ──────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Extract JSON from index.html ─────────────────────────────
console.log('📖 Reading index.html...')
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8')
const match = html.match(/<script type="application\/json" id="__d__">([\s\S]*?)<\/script>/)

if (!match) {
  console.error('❌  Could not find __d__ JSON blob in index.html')
  console.error('   The data may have already been migrated or removed.')
  process.exit(1)
}

let records
try {
  records = JSON.parse(match[1])
} catch (e) {
  console.error('❌  Failed to parse JSON blob:', e.message)
  process.exit(1)
}

if (!Array.isArray(records) || !records.length) {
  console.error('❌  No records found in JSON blob')
  process.exit(1)
}

console.log(`✅  Found ${records.length} influencer records`)

// ─── Normalize records for Supabase ───────────────────────────
function normalize(d) {
  return {
    id: Number(d.id),
    name: d.name || '',
    nickname: d.nickname || '',
    specialization: d.specialization || '',
    intro: d.intro || '',
    gender: d.gender || '',
    avatar: d.avatar || '',
    cover: d.cover || '',
    platforms: d.platforms || {},
    categories: d.categories || [],
    tags: d.tags || [],
    regions: d.regions || [],
    followersAges: d.followersAges || [],
    followersGender: Number(d.followersGender || 0),
    tier: d.tier || '',
    rank: Number(d.rank || 0),
    rangeLabel: d.rangeLabel || '',
    totalFollowers: Number(d.totalFollowers || 0),
    totalFormatted: d.totalFormatted || '',
    source: d.source || 'verified',
    sourceNote: d.sourceNote || '',
    isManuallyAdded: !!d.isManuallyAdded,
  }
}

const normalized = records.map(normalize)

// ─── Insert in batches of 50 ──────────────────────────────────
const BATCH = 50
let inserted = 0
let skipped = 0

for (let i = 0; i < normalized.length; i += BATCH) {
  const batch = normalized.slice(i, i + BATCH)
  const { data, error } = await supabase
    .from('influencers')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
    .select('id')

  if (error) {
    console.error(`❌  Batch ${i / BATCH + 1} failed:`, error.message)
    process.exit(1)
  }

  inserted += data?.length || batch.length
  process.stdout.write(`\r⏳  Inserted ${inserted}/${normalized.length}...`)
}

console.log(`\n✅  Migration complete — ${inserted} records upserted, ${skipped} skipped.`)
console.log('\nNext steps:')
console.log('  1. Verify data in Supabase Table Editor')
console.log('  2. Deploy the updated index.html (without the __d__ blob)')
