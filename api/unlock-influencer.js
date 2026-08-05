import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()

  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.slice(7)

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { influencer_id } = req.body || {}
  if (!influencer_id && influencer_id !== 0) return res.status(400).json({ error: 'influencer_id required' })

  const { data: sub, error: subErr } = await supabase
    .from('subscribers')
    .select('id, plan, credits_remaining, unlocked_ids')
    .eq('id', user.id)
    .single()

  if (subErr || !sub) return res.status(404).json({ error: 'Subscriber not found' })
  if (sub.plan !== 'credits') return res.status(403).json({ error: 'Credits plan required' })

  const unlocked = sub.unlocked_ids || []
  const infId = String(influencer_id)

  // Already unlocked — return current state without deducting
  if (unlocked.includes(infId)) {
    return res.status(200).json({ ok: true, already_unlocked: true, credits_remaining: sub.credits_remaining })
  }

  if (sub.credits_remaining <= 0) {
    return res.status(402).json({ error: 'No credits remaining' })
  }

  const { error: updateErr } = await supabase
    .from('subscribers')
    .update({
      credits_remaining: sub.credits_remaining - 1,
      unlocked_ids: [...unlocked, infId],
    })
    .eq('id', user.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, credits_remaining: sub.credits_remaining - 1 })
}
