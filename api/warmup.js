// Called by Vercel Cron every 5 minutes to keep the influencers function warm
// and prime the in-memory data cache — eliminates cold-start latency for users.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const url = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/influencers?page=1&limit=1`
    await fetch(url)
    return res.status(200).json({ ok: true, ts: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
