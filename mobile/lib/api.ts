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

// scripts/fetch-influencer-images.mjs writes avatar/cover as paths relative
// to the site root (e.g. "assets/influencers/123-avatar.jpg"), which only
// resolves on the web app because the browser has a page URL to resolve
// against. React Native's <Image> has no such context, so relative paths
// must be turned into absolute URLs here. The cartoon placeholder defaults
// are .svg files, which <Image> can't render at all - treat those as "no
// image" so the initial-letter fallback avatar shows instead.
const CARTOON_PLACEHOLDER_RE = /^assets\/(avatar|cover)-(male|female|neutral)\.svg$/

export function resolveImageUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (CARTOON_PLACEHOLDER_RE.test(path)) return undefined
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path
  return `${API_BASE}/${path.replace(/^\/+/, '')}`
}

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

// Spends one credit permanently unlocking a single influencer (the 'credits'
// plan tier - api/unlock-influencer.js lives on the server, not in this repo).
export async function unlockInfluencer(accessToken: string, influencerId: number) {
  const res = await fetch(`${API_BASE}/api/unlock-influencer`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ influencer_id: influencerId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الفتح')
  return json as { credits_remaining: number; plan?: string }
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

// Admin-only writes. api/influencers.js enforces the admin check
// server-side from the JWT - these calls fail with 403 for anyone else.
export async function createInfluencer(accessToken: string, data: Partial<Influencer>) {
  const res = await fetch(`${API_BASE}/api/influencers`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الإضافة')
  return json as Influencer
}

export async function bulkCreateInfluencers(accessToken: string, records: Partial<Influencer>[]) {
  const res = await fetch(`${API_BASE}/api/influencers`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
    body: JSON.stringify(records),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الاستيراد')
  return json as Influencer[]
}

export async function updateInfluencer(accessToken: string, id: number, data: Partial<Influencer>) {
  const res = await fetch(`${API_BASE}/api/influencers`, {
    method: 'PUT',
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ id, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل التعديل')
  return json as Influencer
}

export async function deleteInfluencer(accessToken: string, id: number) {
  const res = await fetch(`${API_BASE}/api/influencers`, {
    method: 'DELETE',
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ id }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الحذف')
  return json
}

// Fetches every influencer record by paging through the API - the admin
// panel needs the full unfiltered set, not one page.
export async function fetchAllInfluencers(accessToken: string): Promise<Influencer[]> {
  const all: Influencer[] = []
  let page = 1
  while (true) {
    const res = await fetchInfluencers(accessToken, page, 500)
    all.push(...res.data)
    if (!res.hasMore) break
    page++
  }
  return all
}

// Matches the real `subscribers` table (supabase/migrations/002_subscribers.sql
// + 005_add_credits_columns.sql) and api/subscribers.js's response shape.
export interface Subscriber {
  id: string
  email: string
  plan: 'free' | 'pro' | 'pending' | 'admin' | 'credits'
  activated_at?: string | null
  expires_at?: string | null
  credits_remaining?: number | null
  unlocked_ids?: string[] | null
}

// Admin-only. api/subscribers.js enforces the admin check server-side from
// the JWT - fails with 403 for anyone else.
export async function fetchAllSubscribers(accessToken: string): Promise<Subscriber[]> {
  const all: Subscriber[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${API_BASE}/api/subscribers?page=${page}&limit=100`,
      { headers: makeHeaders(accessToken) },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`fetch subscribers failed: HTTP ${res.status} ${body}`.slice(0, 300))
    }
    const json = (await res.json()) as { data: Subscriber[]; total: number; page: number; limit: number }
    all.push(...json.data)
    if (all.length >= json.total || !json.data.length) break
    page++
  }
  return all
}

export type SubscriberAction = 'grant-trial' | 'activate' | 'activate-annual' | 'grant-credits' | 'set-admin' | 'revoke'

export async function subscriberAction(
  accessToken: string,
  action: SubscriberAction,
  target: { id?: string; email?: string },
) {
  const res = await fetch(`${API_BASE}/api/subscribers`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ action, ...target }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الإجراء')
  return json
}

export async function deleteSubscriber(accessToken: string, userId: string) {
  const res = await fetch(`${API_BASE}/api/delete-user`, {
    method: 'DELETE',
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ userId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'فشل الحذف')
  return json
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
// 'ar-SA' renders Eastern Arabic-Indic digits (٠-٩), so the locale (and the
// currency suffix) must follow the app language, not stay hardcoded.
export function formatPrice(value?: string | number | null, lang: 'ar' | 'en' = 'ar'): string {
  if (!value && value !== 0) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  const locale = lang === 'en' ? 'en-US' : 'ar-SA'
  const suffix = lang === 'en' ? 'SAR' : 'ر.س'
  return `${n.toLocaleString(locale)} ${suffix}`
}

// Matches web's estimated-price display: floor(n*0.85)-ceil(n*1.15) SAR
export function formatPriceRange(value: number, lang: 'ar' | 'en' = 'ar'): string {
  const locale = lang === 'en' ? 'en-US' : 'ar-SA'
  const suffix = lang === 'en' ? 'SAR' : 'ر.س'
  const low = Math.floor(value * 0.85).toLocaleString(locale)
  const high = Math.ceil(value * 1.15).toLocaleString(locale)
  return `${low}–${high} ${suffix}`
}

// Mirrors estimatePrices() in index.html - when an influencer has no real
// prices set for a platform, the web falls back to a follower-count-based
// estimate (shown as an approximate range) instead of showing nothing. The
// mobile app previously had no equivalent, so influencers without real
// pricing had an empty prices object and were silently excluded from the
// Pro price-range filter entirely, and showed no pricing on their detail
// page - not just an "estimated" label, but nothing at all.
export function estimatePrices(platform: string, followersNum?: number | null): Record<string, number> {
  const f = Number(followersNum) || 0
  const alpha = f >= 5_000_000
  const mega = f >= 1_000_000
  const macro = f >= 100_000
  if (platform === 'سناب شات') {
    if (alpha) return { 'تغطية مع حضور': 200000, 'تغطية بدون حضور': 120000 }
    if (mega) return { 'تغطية مع حضور': 70000, 'تغطية بدون حضور': 40000 }
    if (macro) return { 'تغطية مع حضور': 18000, 'تغطية بدون حضور': 10000 }
    return { 'تغطية مع حضور': 4000, 'تغطية بدون حضور': 2500 }
  }
  if (platform === 'انستقرام') {
    if (alpha) return { 'فيديو/ريلز': 150000, 'صورة': 80000, 'ستورى': 40000 }
    if (mega) return { 'فيديو/ريلز': 45000, 'صورة': 22000, 'ستورى': 12000 }
    if (macro) return { 'فيديو/ريلز': 9000, 'صورة': 4500, 'ستورى': 2500 }
    return { 'فيديو/ريلز': 1800, 'صورة': 900, 'ستورى': 450 }
  }
  if (platform === 'يوتيوب') {
    if (alpha) return { 'إعلان مباشر': 350000, 'إعلان غير مباشر': 150000 }
    if (mega) return { 'إعلان مباشر': 80000, 'إعلان غير مباشر': 35000 }
    if (macro) return { 'إعلان مباشر': 18000, 'إعلان غير مباشر': 8000 }
    return { 'إعلان مباشر': 4000, 'إعلان غير مباشر': 2000 }
  }
  if (platform === 'تيك توك') {
    if (alpha) return { 'فيديو مباشر': 100000, 'فيديو غير مباشر': 50000 }
    if (mega) return { 'فيديو مباشر': 30000, 'فيديو غير مباشر': 15000 }
    if (macro) return { 'فيديو مباشر': 7000, 'فيديو غير مباشر': 3500 }
    return { 'فيديو مباشر': 1500, 'فيديو غير مباشر': 800 }
  }
  if (platform === 'تويتر/X') {
    if (alpha) return { 'تغريدة': 18000, 'إعادة تغريدة': 8000 }
    if (mega) return { 'تغريدة': 6000, 'إعادة تغريدة': 3000 }
    if (macro) return { 'تغريدة': 1500, 'إعادة تغريدة': 700 }
    return { 'تغريدة': 400, 'إعادة تغريدة': 200 }
  }
  return {}
}

// Real prices when set, otherwise the estimated fallback - matches the web's
// dispPrices logic (index.html openModal()).
export function getDisplayPrices(platform: string, p: PlatformData): { prices: Record<string, string | number>; isEstimate: boolean } {
  const real = p.prices || {}
  if (Object.keys(real).length > 0) return { prices: real, isEstimate: false }
  const est = estimatePrices(platform, p.followersNum)
  return { prices: est, isEstimate: Object.keys(est).length > 0 }
}
