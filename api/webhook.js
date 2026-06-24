import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Payhip security: verify using PAYHIP_API_KEY sent as Bearer token
  // OR verify the payhip_token field in the body
  const authHeader = req.headers['authorization'] || ''
  const bodyToken  = req.body?.payhip_token || ''
  const apiKey     = process.env.PAYHIP_API_KEY || ''

  const validAuth  = authHeader === `Bearer ${apiKey}`
  const validToken = bodyToken  === apiKey

  if (!validAuth && !validToken) {
    console.error('Webhook auth failed', { authHeader, bodyToken })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Payhip sends: type, email, product_id, etc.
  const { type, email, buyer_email } = req.body
  const userEmail = (email || buyer_email || '').toLowerCase().trim()

  console.log('Payhip webhook received:', { type, userEmail })

  if (!userEmail) {
    return res.status(400).json({ error: 'No email in payload' })
  }

  // ─── PAYMENT / SALE ───────────────────────────────────────────────
  if (
    type === 'paid'                  ||
    type === 'payment_complete'      ||
    type === 'new_sale'              ||
    type === 'subscription.created'
  ) {
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
  }

  // ─── REFUND / CANCELLATION ────────────────────────────────────────
  if (
    type === 'refund'                ||
    type === 'subscription.deleted'  ||
    type === 'subscription.cancelled'
  ) {
    await supabase
      .from('subscribers')
      .update({ plan: 'free' })
      .eq('email', userEmail)
    console.log('🔴 Revoked pro for', userEmail)
  }

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: true } }
