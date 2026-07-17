import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Read raw body for HMAC verification
async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)

  // Lemon Squeezy security: verify HMAC-SHA256 signature
  const signature = req.headers['x-signature'] || ''
  const secret = process.env.LEMONSQUEEZY_SIGNING_SECRET || ''

  if (!secret) {
    console.error('LEMONSQUEEZY_SIGNING_SECRET not set')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (signature !== digest) {
    console.error('Webhook signature mismatch')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const eventName = payload?.meta?.event_name || ''
  const attrs = payload?.data?.attributes || {}
  const userEmail = (attrs.user_email || '').toLowerCase().trim()

  console.log('Lemon Squeezy webhook received:', { eventName, userEmail })

  if (!userEmail) {
    return res.status(400).json({ error: 'No email in payload' })
  }

  // ─── REFUND / CANCELLATION ────────────────────────────────────────
  const revokeEvents = ['order_refunded', 'subscription_cancelled', 'subscription_expired', 'subscription_paused']
  if (revokeEvents.includes(eventName)) {
    await supabase
      .from('subscribers')
      .update({ plan: 'free' })
      .eq('email', userEmail)
    console.log('🔴 Revoked pro for', userEmail)
    return res.status(200).json({ ok: true })
  }

  // ─── PAYMENT / SALE ───────────────────────────────────────────────
  const grantEvents = ['order_created', 'subscription_created', 'subscription_resumed', 'subscription_updated']
  if (!grantEvents.includes(eventName)) {
    // Unknown event — acknowledge without action
    return res.status(200).json({ ok: true, ignored: eventName })
  }

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

// bodyParser must be false so we can read raw body for HMAC verification
export const config = { api: { bodyParser: false } }
