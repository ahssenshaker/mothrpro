import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

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
  const paymentEmail = (attrs.user_email || '').toLowerCase().trim()

  // account_email = إيميل الحساب المسجّل (مُمرَّر كـ custom data من الـ checkout)
  // إذا لم يُوجد نستخدم إيميل الدفع كـ fallback
  const customData = payload?.meta?.custom_data || {}
  const accountEmail = (customData.account_email || paymentEmail).toLowerCase().trim()

  console.log('Lemon Squeezy webhook:', { eventName, paymentEmail, accountEmail })

  if (!accountEmail) {
    return res.status(400).json({ error: 'No email in payload' })
  }

  // ─── REFUND / CANCELLATION ────────────────────────────────────────
  const revokeEvents = ['order_refunded', 'subscription_cancelled', 'subscription_expired', 'subscription_paused']
  if (revokeEvents.includes(eventName)) {
    await supabase
      .from('subscribers')
      .update({ plan: 'free' })
      .eq('email', accountEmail)
    console.log('🔴 Revoked pro for', accountEmail)
    return res.status(200).json({ ok: true })
  }

  // ─── PAYMENT / SALE ───────────────────────────────────────────────
  const grantEvents = ['order_created', 'subscription_created', 'subscription_resumed', 'subscription_updated']
  if (!grantEvents.includes(eventName)) {
    return res.status(200).json({ ok: true, ignored: eventName })
  }

  // subscription_updated fires for any change — including cancellations.
  // If the subscription is no longer active, treat it as a revoke instead.
  if (eventName === 'subscription_updated') {
    const status = attrs.status || ''
    const inactiveStatuses = ['cancelled', 'expired', 'paused', 'unpaid', 'past_due']
    if (inactiveStatuses.includes(status)) {
      await supabase
        .from('subscribers')
        .update({ plan: 'free' })
        .eq('email', accountEmail)
      console.log('🔴 Revoked pro via subscription_updated (status:', status, ') for', accountEmail)
      return res.status(200).json({ ok: true })
    }
  }

  const { data: sub } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', accountEmail)
    .single()

  if (sub) {
    await supabase
      .from('subscribers')
      .update({ plan: 'pro', activated_at: new Date().toISOString(), expires_at: null })
      .eq('email', accountEmail)
    console.log('✅ Activated pro for', accountEmail)
  } else {
    // لا يوجد subscriber — احفظ كـ pending حتى يسجّل المستخدم.
    // عند تسجيل الدخول، registerUserIfNew() تُصحح الـ id وactivatePendingIfExists() ترقّيه.
    await supabase
      .from('subscribers')
      .insert({
        id: crypto.randomUUID(),
        email: accountEmail,
        plan: 'pending',
        activated_at: new Date().toISOString()
      })
    console.log('⏳ Saved as pending for', accountEmail)
  }

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: false } }
