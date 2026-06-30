import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Gumroad security: verify using your Gumroad seller_id
  // Gumroad sends "ping" as application/x-www-form-urlencoded
  const body = req.body || {}
  const sellerId = body.seller_id || ''
  const expectedSellerId = process.env.GUMROAD_SELLER_ID || ''

  if (!expectedSellerId || sellerId !== expectedSellerId) {
    console.error('Webhook auth failed', { sellerId })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userEmail = (body.email || '').toLowerCase().trim()
  const refunded  = body.refunded === 'true' || body.refunded === true
  const cancelled = body.subscription_cancelled === 'true' || body.subscription_cancelled === true || body.subscription_ended_at

  console.log('Gumroad webhook received:', { userEmail, refunded, cancelled })

  if (!userEmail) {
    return res.status(400).json({ error: 'No email in payload' })
  }

  // ─── REFUND / CANCELLATION ────────────────────────────────────────
  if (refunded || cancelled) {
    await supabase
      .from('subscribers')
      .update({ plan: 'free' })
      .eq('email', userEmail)
    console.log('🔴 Revoked pro for', userEmail)
    return res.status(200).json({ ok: true })
  }

  // ─── PAYMENT / SALE ───────────────────────────────────────────────
  const { data: sub } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (sub) {
    await supabase
      .from('subscribers')
      .update({ plan: 'pro', activated_at: new Date().toISOString() })
      .eq('email', userEmail)
    console.log('✅ Activated pro for', userEmail)
  } else {
    // دفع قبل إنشاء الحساب — يُخزَّن كـ pending
    await supabase
      .from('subscribers')
      .insert({
        id: crypto.randomUUID(),
        email: userEmail,
        plan: 'pending',
        activated_at: new Date().toISOString()
      })
    console.log('⏳ Saved as pending for', userEmail)
  }

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: true } }
