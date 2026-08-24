import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // التحقق من الـ JWT token
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  const email = user.email?.toLowerCase().trim()
  if (!email) return res.status(400).json({ error: 'No email' })

  // ابحث عن pending row بنفس الإيميل
  const { data: pending } = await supabase
    .from('subscribers')
    .select('id, plan')
    .eq('email', email)
    .single()

  if (!pending) {
    // لا يوجد أي سجل — أنشئ واحد free
    await supabase.from('subscribers').insert({
      id: user.id,
      email,
      plan: 'free',
    })
    return res.status(200).json({ activated: false, plan: 'free' })
  }

  if (pending.plan === 'pending') {
    // دفع سابق بدون حساب — فعّله الآن
    await supabase
      .from('subscribers')
      .update({ id: user.id, plan: 'pro', activated_at: new Date().toISOString(), expires_at: null })
      .eq('email', email)
    console.log('✅ Activated pending subscriber:', email)
    return res.status(200).json({ activated: true, plan: 'pro' })
  }

  if (pending.id !== user.id) {
    // The row's id doesn't match this auth user - the webhook created it with
    // a fresh random id because it fired before this account's own row existed
    // (e.g. a new user paying immediately after signup, before this endpoint's
    // first call finished). The frontend looks the row up by id, so without
    // this fix the plan/credits silently never appear despite the payment
    // having gone through. Reconcile the id now.
    await supabase.from('subscribers').update({ id: user.id }).eq('email', email)
    console.log('🔧 Reconciled subscriber id mismatch for', email)
    return res.status(200).json({ activated: true, plan: pending.plan })
  }

  return res.status(200).json({ activated: false, plan: pending.plan })
}
