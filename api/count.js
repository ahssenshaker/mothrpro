import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const BOT_UA_PATTERNS = [
  'headlesschrome', 'phantomjs', 'slimejs', 'splash',
  'python-requests', 'python-httpx', 'python/',
  'scrapy', 'curl/', 'wget/', 'libcurl',
  'go-http-client', 'java/', 'okhttp', 'ruby',
  'mechanize', 'aiohttp', 'httpx',
]

const ALLOWED_ORIGINS = [
  'https://moatherpro.com',
  'https://www.moatherpro.com',
  'http://localhost',
  'http://127.0.0.1',
]

// Shared secret embedded in the mobile app build — see api/influencers.js
// for why the Origin/UA checks below can't be satisfied by the native app.
const MOBILE_APP_KEY = 'Lu2vva_pvSQLpvzeqjYymO7ecCWImi_k'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300')

  const isTrustedMobileApp = req.headers['x-app-key'] === MOBILE_APP_KEY

  if (!isTrustedMobileApp) {
    const ua = (req.headers['user-agent'] || '').toLowerCase()
    if (!ua || BOT_UA_PATTERNS.some(p => ua.includes(p))) {
      return res.status(403).json({ count: 0 })
    }

    const origin = req.headers.origin || req.headers.referer || ''
    if (!origin || !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      return res.status(403).json({ count: 0 })
    }
  }

  try {
    const { count, error } = await supabase
      .from('influencers')
      .select('id', { count: 'exact', head: true })
    if (error) return res.status(500).json({ count: 0 })
    return res.status(200).json({ count: count || 0 })
  } catch {
    return res.status(500).json({ count: 0 })
  }
}

export const config = { api: { bodyParser: false } }
