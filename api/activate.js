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
      .update({ id: user.id, plan: 'pro', activated_at: new Date().toISOString() })
      .eq('email', email)
    console.log('✅ Activated pending subscriber:', email)
    return res.status(200).json({ activated: true, plan: 'pro' })
  }

  return res.status(200).json({ activated: false, plan: pending.plan })
}
