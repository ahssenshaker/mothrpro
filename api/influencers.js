import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// In-memory rate limiter — works per-instance; provides best-effort protection
// in serverless environments where instances may not be shared.
const rateLimitMap = new Map()

function getRateLimitKey(userId, req) {
  if (userId) return `user:${userId}`
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown'
  return `ip:${ip}`
}

function isRateLimited(key, max = 30) {
  const now = Date.now()
  const windowMs = 60_000
  const entry = rateLimitMap.get(key) || { count: 0, start: now }
  if (now - entry.start > windowMs) {
    rateLimitMap.set(key, { count: 1, start: now })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  rateLimitMap.set(key, entry)
  return false
}

// Resolve user plan from Supabase JWT
async function resolveUserPlan(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { plan: 'free', userId: null }
  const token = authHeader.slice(7)
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return { plan: 'free', userId: null }
    const { data: sub } = await supabase
      .from('subscribers')
      .select('plan, expires_at')
      .eq('id', user.id)
      .single()
    if (!sub) return { plan: 'free', userId: user.id }
    if (sub.plan === 'admin') return { plan: 'admin', userId: user.id }
    if (sub.plan === 'pro') {
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) return { plan: 'free', userId: user.id }
      return { plan: 'pro', userId: user.id }
    }
    return { plan: 'free', userId: user.id }
  } catch {
    return { plan: 'free', userId: null }
  }
}

// Strip sensitive fields for free users
function censorRecord(record) {
  const out = { ...record }
  if (out.platforms && typeof out.platforms === 'object') {
    const platforms = {}
    Object.keys(out.platforms).forEach(name => {
      const p = out.platforms[name] || {}
      platforms[name] = {
        followers: p.followers,
        followersNum: p.followersNum,
        url: null,
        avgLikes: null,
        avgComments: null,
        engagementRate: null,
        postsPerWeek: null,
        prices: null
      }
    })
    out.platforms = platforms
  }
  out.followersAges = []
  out.followersGender = 0
  return out
}

export default async function handler(req, res) {
  const { plan, userId } = await resolveUserPlan(req.headers.authorization)
  const isAdmin = plan === 'admin'
  const isPro = plan === 'pro' || isAdmin

  // Rate limit all GET requests — Pro users get a higher cap (need multiple pages)
  if (req.method === 'GET') {
    const rlKey = getRateLimitKey(userId, req)
    const rlMax = isPro ? 60 : 30
    if (isRateLimited(rlKey, rlMax)) {
      return res.status(429).json({ error: 'Too many requests, slow down' })
    }
  }

  // ─── GET: list influencers (paginated) ───────────────────────────────
  if (req.method === 'GET') {
    // Anonymous users always receive censored data — safe to cache briefly at the CDN edge.
    // Authenticated responses are user-specific and must never be cached.
    res.setHeader('Cache-Control', userId
      ? 'private, no-store'
      : 's-maxage=60, stale-while-revalidate=120'
    )

    const rawLimit = parseInt(req.query.limit)
    const page  = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 100))
    const from  = (page - 1) * limit
    const to    = from + limit - 1

    const { data, error, count } = await supabase
      .from('influencers')
      .select('*', { count: 'exact' })
      .order('rank', { ascending: true })
      .range(from, to)

    if (error) return res.status(500).json({ error: error.message })

    const processed = isPro ? data : data.map(censorRecord)
    return res.status(200).json({
      data: processed,
      page,
      limit,
      total: count,
      hasMore: to < count - 1
    })
  }

  // ─── Admin-only methods below ─────────────────────────────────────────
  res.setHeader('Cache-Control', 'no-store')
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

  // ─── POST: create one or many influencers ─────────────────────────────
  if (req.method === 'POST') {
    const body = req.body
    if (Array.isArray(body)) {
      const { data, error } = await supabase
        .from('influencers')
        .insert(body)
        .select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }
    const { data, error } = await supabase
      .from('influencers')
      .insert(body)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ─── PUT: update influencer ───────────────────────────────────────────
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('influencers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ─── DELETE: remove influencer ────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('influencers').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}

export const config = { api: { bodyParser: true } }
