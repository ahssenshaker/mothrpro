import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// In-memory data cache — populated on first GET, shared across warm invocations.
let _dataCache = null
let _dataCacheTs = 0
const DATA_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// In-memory plan cache — avoids 2 Supabase calls per authenticated request.
const planCache = new Map() // userId → { plan, ts }
const PLAN_CACHE_TTL = 5 * 60 * 1000

// Free-tier record cap — limits how many rows a free/censored request may receive.
// Prevents bulk scraping of the influencer list without a paid subscription.
const FREE_RECORD_CAP = 50

// Distributed rate limiter backed by Vercel KV when available,
// falling back to in-memory per-instance tracking otherwise.
const rateLimitMap = new Map()
let _kv = null

async function getKV() {
  if (_kv) return _kv
  if (!process.env.KV_REST_API_URL) return null
  try {
    const mod = await import('@vercel/kv')
    _kv = mod.kv
    return _kv
  } catch {
    return null
  }
}

function getRateLimitKey(userId, req) {
  if (userId) return `user:${userId}`
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown'
  return `ip:${ip}`
}

async function isRateLimited(key, max = 30) {
  const kv = await getKV()
  if (kv) {
    try {
      const windowKey = `rl:${key}:${Math.floor(Date.now() / 60_000)}`
      const count = await kv.incr(windowKey)
      if (count === 1) await kv.expire(windowKey, 61)
      return count > max
    } catch {
      // fall through to in-memory
    }
  }
  const now = Date.now()
  const entry = rateLimitMap.get(key) || { count: 0, start: now }
  if (now - entry.start > 60_000) {
    rateLimitMap.set(key, { count: 1, start: now })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  rateLimitMap.set(key, entry)
  return false
}

// Resolve user plan from Supabase JWT, with short-lived in-memory cache.
async function resolveUserPlan(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { plan: 'free', userId: null, debug: 'no-bearer-header' }
  const token = authHeader.slice(7)
  try {
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token)
    if (!user) return { plan: 'free', userId: null, debug: getUserError?.message || 'getUser returned no user' }

    const cached = planCache.get(user.id)
    if (cached && (Date.now() - cached.ts) < PLAN_CACHE_TTL) {
      return { plan: cached.plan, userId: user.id }
    }

    const { data: sub } = await supabase
      .from('subscribers')
      .select('plan, expires_at')
      .eq('id', user.id)
      .single()

    let resolvedPlan = 'free'
    if (sub) {
      if (sub.plan === 'admin') {
        resolvedPlan = 'admin'
      } else if (sub.plan === 'pro') {
        if (!sub.expires_at || new Date(sub.expires_at) >= new Date()) resolvedPlan = 'pro'
      }
    }

    planCache.set(user.id, { plan: resolvedPlan, ts: Date.now() })
    return { plan: resolvedPlan, userId: user.id }
  } catch (e) {
    return { plan: 'free', userId: null, debug: e?.message || 'exception in resolveUserPlan' }
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

// Known automation / bot User-Agent fragments to reject.
const BOT_UA_PATTERNS = [
  'headlesschrome', 'phantomjs', 'slimejs', 'splash',
  'python-requests', 'python-httpx', 'python/',
  'scrapy', 'curl/', 'wget/', 'libcurl',
  'go-http-client', 'java/', 'okhttp', 'ruby',
  'mechanize', 'aiohttp', 'httpx',
]

function isBotRequest(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase()
  if (!ua) return true // no UA at all — almost certainly a script
  return BOT_UA_PATTERNS.some(p => ua.includes(p))
}

// Allowed request origins — any other origin is rejected.
const ALLOWED_ORIGINS = [
  'https://moatherpro.com',
  'https://www.moatherpro.com',
  'http://localhost',
  'http://127.0.0.1',
]

function isAllowedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || ''
  if (!origin) return false // browser fetch() always sends Origin for same-origin requests
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o))
}

// Shared secret embedded in the mobile app build — lets the native client
// through without an Origin header, which fetch() on iOS/Android silently
// drops (Origin is a forbidden request header, unlike in a browser).
const MOBILE_APP_KEY = 'Lu2vva_pvSQLpvzeqjYymO7ecCWImi_k'

function isTrustedMobileApp(req) {
  return req.headers['x-app-key'] === MOBILE_APP_KEY
}

export default async function handler(req, res) {
  // Security headers on every response
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet')

  // Internal cron bypass — allows the warmup endpoint to prime the data cache
  // without a user JWT. Validated against WARMUP_SECRET env var.
  const isWarmup = !!(
    process.env.WARMUP_SECRET &&
    req.headers['x-warmup-secret'] === process.env.WARMUP_SECRET
  )

  // Block automated scrapers and requests not originating from the site.
  // The warmup cron call and the mobile app (verified via shared key) are exempted.
  if (!isWarmup && !isTrustedMobileApp(req)) {
    if (isBotRequest(req)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!isAllowedOrigin(req)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  const { plan, userId, debug } = isWarmup
    ? { plan: 'admin', userId: 'warmup' }
    : await resolveUserPlan(req.headers.authorization)

  const isAdmin = plan === 'admin'
  const isPro = plan === 'pro' || isAdmin

  // Require authentication for all GET requests (prevents anonymous scraping).
  // TEMP: extra fields included while diagnosing a mobile-app 401 - remove once resolved.
  // Checking whether a cross-origin redirect (e.g. apex -> www) is stripping
  // the Authorization header before the request reaches this function, per
  // the Fetch spec's "strip Authorization on cross-origin redirect" rule.
  if (req.method === 'GET' && !isWarmup && !userId) {
    return res.status(401).json({
      error: 'يرجى تسجيل الدخول',
      debug,
      _diag: {
        host: req.headers.host,
        origin: req.headers.origin || null,
        hasAuthHeader: !!req.headers.authorization,
        hasAppKey: !!req.headers['x-app-key'],
      },
    })
  }

  // Rate limit authenticated GET requests (warmup is exempt).
  if (req.method === 'GET' && !isWarmup) {
    const rlKey = getRateLimitKey(userId, req)
    const rlMax = isPro ? 60 : 30
    if (await isRateLimited(rlKey, rlMax)) {
      return res.status(429).json({ error: 'Too many requests, slow down' })
    }
  }

  // ─── GET: list influencers (paginated) ───────────────────────────────
  if (req.method === 'GET') {
    // Admin always gets fresh data. Pro gets a short private browser cache.
    // Free authenticated users get a minimal private cache.
    if (isAdmin) {
      res.setHeader('Cache-Control', 'private, no-store')
    } else if (isPro) {
      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    } else {
      res.setHeader('Cache-Control', 'private, max-age=60')
    }

    const rawLimit = parseInt(req.query.limit)
    const page  = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(500, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 100))

    // Serve from in-memory cache when available — zero Supabase round-trip
    const now = Date.now()
    if (!_dataCache || (now - _dataCacheTs) > DATA_CACHE_TTL) {
      const { data, error, count } = await supabase
        .from('influencers')
        .select('*', { count: 'exact' })
        .order('rank', { ascending: true })
      if (error) return res.status(500).json({ error: error.message })
      _dataCache = { rows: data, count }
      _dataCacheTs = now
    }

    const { rows: allRows, count } = _dataCache
    const from = (page - 1) * limit

    if (!isPro) {
      // Free users are capped at FREE_RECORD_CAP records total — anti-scraping gate.
      if (from >= FREE_RECORD_CAP) {
        return res.status(200).json({
          data: [], page, limit,
          total: count,
          hasMore: false,
          freeCap: FREE_RECORD_CAP,
        })
      }
      const end = Math.min(from + limit, FREE_RECORD_CAP)
      const pageRows = allRows.slice(from, end).map(censorRecord)
      return res.status(200).json({
        data: pageRows, page, limit,
        total: count,
        hasMore: false,
        freeCap: FREE_RECORD_CAP,
      })
    }

    const pageRows = allRows.slice(from, from + limit)
    return res.status(200).json({
      data: isPro ? pageRows : pageRows.map(censorRecord),
      page,
      limit,
      total: count,
      hasMore: from + limit < count,
    })
  }

  // ─── Admin-only methods below ─────────────────────────────────────────
  res.setHeader('Cache-Control', 'no-store')
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

  // Any write invalidates the in-memory data cache so the next GET fetches fresh data
  _dataCache = null
  _dataCacheTs = 0

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
