import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const signature = req.body.signature
  const apiKey = process.env.PAYHIP_API_KEY

  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(JSON.stringify(req.body))
    .digest('hex')

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const { type, email } = req.body

  if (type === 'paid' || type === 'subscription.created') {
    // Find user in subscribers table
    const { data: sub } = await supabase
      .from('subscribers')
      .select('id')
      .eq('email', email)
      .single()

    if (sub) {
      await supabase
        .from('subscribers')
        .update({ plan: 'pro', activated_at: new Date().toISOString() })
        .eq('email', email)
    } else {
      // User paid before creating account — save as pending
      await supabase
        .from('subscribers')
        .insert({ id: crypto.randomUUID(), email, plan: 'pending', activated_at: new Date().toISOString() })
    }
  }

  if (type === 'subscription.deleted') {
    await supabase
      .from('subscribers')
      .update({ plan: 'free' })
      .eq('email', email)
  }

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: true } }
