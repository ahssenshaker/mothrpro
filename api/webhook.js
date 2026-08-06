import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ─── Plan variant IDs ─────────────────────────────────────────────────────────
const VARIANT_CREDITS  = 1985417  // 49 SAR  — 10 credits
const VARIANT_ANNUAL   = 1919783  // 149 SAR — annual subscription
const VARIANT_LIFETIME = 1985421  // 349 SAR — lifetime

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)

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

  const eventName   = payload?.meta?.event_name || ''
  const isTestMode  = payload?.meta?.test_mode === true
  const attrs       = payload?.data?.attributes || {}
  const customData  = payload?.meta?.custom_data || {}
  const paymentEmail  = (attrs.user_email || '').toLowerCase().trim()
  const accountEmail  = (customData.account_email || paymentEmail).toLowerCase().trim()

  // Variant ID is in different places for orders vs subscriptions
  const variantId = Number(
    attrs.first_order_item?.variant_id ||  // order_created
    attrs.variant_id ||                     // subscription_*
    0
  )

  const logPrefix = isTestMode ? '[TEST]' : '[LIVE]'
  console.log(`${logPrefix} Lemon Squeezy webhook:`, { eventName, accountEmail, variantId })

  // Test mode: process normally so you can verify the full flow, but log clearly
  if (isTestMode) {
    console.log('[TEST] ⚠️ Test mode event — DB will be updated with test data')
  }

  if (!accountEmail) {
    return res.status(400).json({ error: 'No email in payload' })
  }

  // ─── REFUND / CANCELLATION ────────────────────────────────────────────────
  const revokeEvents = ['order_refunded', 'subscription_cancelled', 'subscription_expired', 'subscription_paused']
  if (revokeEvents.includes(eventName)) {
    await supabase
      .from('subscribers')
      .update({ plan: 'free', expires_at: null })
      .eq('email', accountEmail)
    console.log('🔴 Revoked for', accountEmail)
    return res.status(200).json({ ok: true })
  }

  // ─── PAYMENT / SALE ───────────────────────────────────────────────────────
  const grantEvents = ['order_created', 'subscription_created', 'subscription_resumed', 'subscription_updated']
  if (!grantEvents.includes(eventName)) {
    return res.status(200).json({ ok: true, ignored: eventName })
  }

  // subscription_updated fires for any change — only act on active status
  if (eventName === 'subscription_updated') {
    const status = attrs.status || ''
    const inactiveStatuses = ['cancelled', 'expired', 'paused', 'unpaid', 'past_due']
    if (inactiveStatuses.includes(status)) {
      await supabase
        .from('subscribers')
        .update({ plan: 'free', expires_at: null })
        .eq('email', accountEmail)
      console.log('🔴 Revoked via subscription_updated (status:', status, ') for', accountEmail)
      return res.status(200).json({ ok: true })
    }
  }

  // ─── Find or create subscriber row ───────────────────────────────────────
  const { data: sub } = await supabase
    .from('subscribers')
    .select('id, plan, credits_remaining, unlocked_ids')
    .eq('email', accountEmail)
    .single()

  const now = new Date().toISOString()

  // ─── CREDITS (49 SAR) ─────────────────────────────────────────────────────
  if (variantId === VARIANT_CREDITS) {
    const currentCredits = sub?.credits_remaining || 0
    const updates = {
      credits_remaining: currentCredits + 10,
      activated_at: now,
    }
    // Only set plan to 'credits' if they don't already have a higher plan
    const higherPlans = ['pro', 'admin']
    if (!sub || !higherPlans.includes(sub.plan)) {
      updates.plan = 'credits'
    }

    if (sub) {
      await supabase.from('subscribers').update(updates).eq('id', sub.id)
      console.log('⚡ Added 10 credits for', accountEmail, '→ total:', currentCredits + 10)
    } else {
      await supabase.from('subscribers').insert({
        id: crypto.randomUUID(),
        email: accountEmail,
        plan: 'credits',
        credits_remaining: 10,
        unlocked_ids: [],
        activated_at: now,
      })
      console.log('⚡ New credits subscriber:', accountEmail)
    }
    return res.status(200).json({ ok: true })
  }

  // ─── ANNUAL SUBSCRIPTION (149 SAR) ───────────────────────────────────────
  if (variantId === VARIANT_ANNUAL) {
    const expiresAt = attrs.renews_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    if (sub) {
      await supabase
        .from('subscribers')
        .update({ plan: 'pro', expires_at: expiresAt, activated_at: now })
        .eq('id', sub.id)
      console.log('✅ Annual activated for', accountEmail, '→ expires:', expiresAt)
    } else {
      await supabase.from('subscribers').insert({
        id: crypto.randomUUID(),
        email: accountEmail,
        plan: 'pro',
        expires_at: expiresAt,
        activated_at: now,
      })
      console.log('✅ New annual subscriber:', accountEmail)
    }
    return res.status(200).json({ ok: true })
  }

  // ─── LIFETIME (349 SAR) ───────────────────────────────────────────────────
  if (variantId === VARIANT_LIFETIME) {
    if (sub) {
      await supabase
        .from('subscribers')
        .update({ plan: 'pro', expires_at: null, activated_at: now })
        .eq('id', sub.id)
      console.log('✅ Lifetime activated for', accountEmail)
    } else {
      await supabase.from('subscribers').insert({
        id: crypto.randomUUID(),
        email: accountEmail,
        plan: 'pro',
        expires_at: null,
        activated_at: now,
      })
      console.log('✅ New lifetime subscriber:', accountEmail)
    }
    return res.status(200).json({ ok: true })
  }

  // ─── FALLBACK (unknown variant — legacy or manual) ────────────────────────
  console.warn('⚠️ Unknown variant_id:', variantId, '— falling back to pro')
  if (sub) {
    await supabase
      .from('subscribers')
      .update({ plan: 'pro', activated_at: now, expires_at: null })
      .eq('id', sub.id)
  } else {
    await supabase.from('subscribers').insert({
      id: crypto.randomUUID(),
      email: accountEmail,
      plan: 'pending',
      activated_at: now,
    })
  }
  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: false } }
