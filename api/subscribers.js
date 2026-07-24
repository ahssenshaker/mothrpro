import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function resolveAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return null
    const { data: sub } = await supabase
      .from('subscribers')
      .select('plan')
      .eq('id', user.id)
      .single()
    return sub?.plan === 'admin' ? user : null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const admin = await resolveAdmin(req.headers.authorization)
  if (!admin) return res.status(403).json({ error: 'Admin only' })

  // ─── GET: list all subscribers (paginated) ───────────────────────────
  if (req.method === 'GET') {
    const rawLimit = parseInt(req.query.limit)
    const page  = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 100))
    const from  = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('subscribers')
      .select('*', { count: 'exact' })
      .order('activated_at', { ascending: false })
      .range(from, from + limit - 1)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data, total: count, page, limit })
  }

  // ─── POST: manage subscriber plan ────────────────────────────────────
  if (req.method === 'POST') {
    const { action, id, email } = req.body || {}
    if (!action) return res.status(400).json({ error: 'action required' })

    if (action === 'activate' || action === 'set-admin') {
      // Resolve subscriber by id or email
      let findQuery = supabase.from('subscribers').select('id')
      if (id) {
        findQuery = findQuery.eq('id', id)
      } else if (email) {
        findQuery = findQuery.eq('email', email.toLowerCase().trim())
      } else {
        return res.status(400).json({ error: 'id or email required' })
      }
      const { data: sub, error: findErr } = await findQuery.single()
      if (findErr || !sub) return res.status(404).json({ error: 'Subscriber not found' })

      const updates = action === 'activate'
        ? { plan: 'pro', activated_at: new Date().toISOString() }
        : { plan: 'admin' }

      const { error } = await supabase
        .from('subscribers')
        .update(updates)
        .eq('id', sub.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'revoke') {
      if (!id) return res.status(400).json({ error: 'id required' })
      const { error } = await supabase
        .from('subscribers')
        .update({ plan: 'free' })
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).end()
}
