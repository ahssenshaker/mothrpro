import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Rate limiting: max 30 requests per minute per user
const rateLimitMap = new Map()
function isRateLimited(userId) {
  const now = Date.now()
  const windowMs = 60_000
  const max = 30
  const entry = rateLimitMap.get(userId) || { count: 0, start: now }
  if (now - entry.start > windowMs) {
    rateLimitMap.set(userId, { count: 1, start: now })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  rateLimitMap.set(userId, entry)
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

// Strip sensitive fields for free users — keep follower counts and stats visible
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
  // Hide audience demographics for free users
  out.followersAges = []
  out.followersGender = 0
  return out
}

export default async function handler(req, res) {
  // CORS headers for same-origin requests
  res.setHeader('Cache-Control', 'no-store')

  const { plan, userId } = await resolveUserPlan(req.headers.authorization)
  const isAdmin = plan === 'admin'
  const isPro = plan === 'pro' || isAdmin

  // Rate limit Pro/trial users to prevent data scraping
  if (isPro && userId && isRateLimited(userId)) {
    return res.status(429).json({ error: 'Too many requests, slow down' })
  }

  // ─── GET: list influencers ────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .order('rank', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(isPro ? data : data.map(censorRecord))
  }

  // ─── Admin-only methods below ─────────────────────────────────────────
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

  // ─── POST: create one or many influencers ─────────────────────────────
  if (req.method === 'POST') {
    const body = req.body
    if (Array.isArray(body)) {
      // Batch insert
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
