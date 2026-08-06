import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  const email = user.email?.toLowerCase().trim()
  if (!email) return res.status(400).json({ error: 'No email' })

  const now = new Date().toISOString()

  // 1. Check by user.id — catches rows created by DB triggers
  const { data: myRow } = await supabase
    .from('subscribers')
    .select('id, plan, expires_at, activated_at')
    .eq('id', user.id)
    .single()

  if (myRow) {
    // Detect trigger-granted trial: plan='pro', short expires_at, brand-new account
    if (myRow.plan === 'pro' && myRow.expires_at) {
      const expMs    = new Date(myRow.expires_at) - Date.now()
      const userAgeMs = Date.now() - new Date(user.created_at).getTime()
      const isTrial  = expMs < 48 * 3_600_000        // expires within 48 h
      const isNewUser = userAgeMs < 5 * 60 * 1000    // account created < 5 min ago
      if (isTrial && isNewUser) {
        await supabase
          .from('subscribers')
          .update({ plan: 'free', expires_at: null, activated_at: null })
          .eq('id', user.id)
        console.log('🔄 Reset trigger-granted trial → free for new user:', email)
        return res.status(200).json({ activated: false, plan: 'free' })
      }
    }
    return res.status(200).json({ activated: false, plan: myRow.plan })
  }

  // 2. Check by email — payment made before account was created
  const { data: emailRow } = await supabase
    .from('subscribers')
    .select('id, plan')
    .eq('email', email)
    .single()

  if (emailRow?.plan === 'pending') {
    await supabase
      .from('subscribers')
      .update({ id: user.id, plan: 'pro', activated_at: now, expires_at: null })
      .eq('email', email)
    console.log('✅ Activated pending subscriber:', email)
    return res.status(200).json({ activated: true, plan: 'pro' })
  }

  // 3. Truly new user — create free row
  await supabase.from('subscribers').insert({ id: user.id, email, plan: 'free' })
  return res.status(200).json({ activated: false, plan: 'free' })
}
