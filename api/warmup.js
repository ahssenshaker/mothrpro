// Called by Vercel Cron every 5 minutes to keep the influencers function warm
// and prime the in-memory data cache — eliminates cold-start latency for users.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const headers = {}
    if (process.env.WARMUP_SECRET) headers['x-warmup-secret'] = process.env.WARMUP_SECRET

    // Always hit the production domain so the cron warms the live deployment,
    // not a preview URL that VERCEL_URL might resolve to.
    const base = process.env.PRODUCTION_URL || 'https://moatherpro.com'
    await fetch(`${base}/api/influencers?page=1&limit=1`, { headers })
    return res.status(200).json({ ok: true, ts: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
