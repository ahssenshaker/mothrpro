// Matches the real `influencers` table (supabase/migrations/001_influencers.sql)
// and api/influencers.js's response shape — not a REST-flat guess.
export interface PlatformData {
  followers: string
  followersNum: number
  url: string | null
  avgLikes: number | null
  avgComments: number | null
  engagementRate: number | null
  postsPerWeek: number | null
  prices: Record<string, string> | null
}

export interface Influencer {
  id: number
  name: string
  nickname?: string
  specialization?: string
  intro?: string
  gender?: string
  avatar?: string
  cover?: string
  platforms: Record<string, PlatformData>
  categories?: string[]
  tags?: string[]
  regions?: string[]
  followersAges?: string[]
  // Category code, not a percentage: 0 = balanced/unknown, 1 = mostly male, 2 = mostly female.
  followersGender?: number
  tier?: string
  rank?: number
  rangeLabel?: string
  totalFollowers: number
  totalFormatted?: string
  source?: string
  sourceNote?: string
  isManuallyAdded?: boolean
  name_en?: string
  specialization_en?: string
  intro_en?: string
  categories_en?: string[]
  tags_en?: string[]
  regions_en?: string[]
}

// Picks the platform with the most followers, for card/summary views that
// show one badge/stat set rather than the full per-platform breakdown.
export function getPrimaryPlatform(inf: Influencer): [string, PlatformData] | null {
  const entries = Object.entries(inf.platforms || {})
  if (!entries.length) return null
  return entries.reduce((best, cur) => (cur[1].followersNum > best[1].followersNum ? cur : best))
}

// www, not the apex domain: the apex redirects to www, and fetch() strips
// the Authorization header on cross-origin redirects (per the Fetch spec) -
// confirmed via server-side diagnostics (req.headers.host was www even
// though the app requested the apex domain).
const API_BASE = 'https://www.moatherpro.com'

// Matches MOBILE_APP_KEY in api/influencers.js and api/count.js. Lets the
// native app through the bot/origin gate — fetch() on iOS/Android can't set
// an Origin header (it's a forbidden request header), so those checks would
// otherwise always fail for this app.
const MOBILE_APP_KEY = 'Lu2vva_pvSQLpvzeqjYymO7ecCWImi_k'

function makeHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-App-Key': MOBILE_APP_KEY,
    'Content-Type': 'application/json',
  }
}

export async function activateUser(accessToken: string) {
  const res = await fetch(`${API_BASE}/api/activate`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
  })
  if (!res.ok) throw new Error('activate failed')
  return res.json() as Promise<{ activated: boolean; plan: string }>
}

export async function fetchInfluencers(
  accessToken: string,
  page = 1,
  limit = 100,
) {
  const res = await fetch(
    `${API_BASE}/api/influencers?page=${page}&limit=${limit}`,
    { headers: makeHeaders(accessToken) },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`fetch influencers failed: HTTP ${res.status} ${body}`.slice(0, 300))
  }
  return res.json() as Promise<{
    data: Influencer[]
    total: number
    page: number
    limit: number
    hasMore: boolean
  }>
}

export async function fetchCount() {
  const res = await fetch(`${API_BASE}/api/count`, {
    headers: { 'X-App-Key': MOBILE_APP_KEY },
  })
  if (!res.ok) return { count: 0 }
  return res.json() as Promise<{ count: number }>
}

export function getTier(followers?: number | null): string {
  const n = Number(followers || 0)
  if (n >= 5_000_000) return 'ألفا'
  if (n >= 1_000_000) return 'ميجا'
  if (n >= 100_000) return 'ماكرو'
  if (n >= 10_000) return 'ميكرو'
  return 'نانو'
}

export function formatFollowers(n?: number | null): string {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return String(v)
}

// Price values are free-form strings the admin typed in (e.g. "5000"), keyed
// by an arbitrary label (e.g. "صورة", "فيديو") - not a fixed set of fields.
export function formatPrice(value?: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return `${n.toLocaleString('ar-SA')} ر.س`
}
