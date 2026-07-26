import { createClient } from '@supabase/supabase-js'
import { resolveAdmin } from './_auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function sendPlanEmail(email, action) {
  const key = process.env.RESEND_API_KEY
  if (!key || !email) return

  const subjects = {
    activate:  'تم تفعيل اشتراكك في مؤثر برو ✨',
    revoke:    'تم إيقاف اشتراكك في مؤثر برو',
    'set-admin': 'تمت ترقيتك كمشرف في مؤثر برو',
  }
  const bodies = {
    activate: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#63b3ed">مرحباً بك في مؤثر برو Pro ✨</h2>
      <p>تم تفعيل اشتراكك بنجاح. يمكنك الآن الوصول إلى جميع بيانات المؤثرين بما فيها الأسعار الفعلية ونسب التفاعل.</p>
      <a href="https://moatherpro.com" style="display:inline-block;background:#63b3ed;color:#07090f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:12px">افتح مؤثر برو</a>
    </div>`,
    revoke: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>تحديث اشتراكك في مؤثر برو</h2>
      <p>تم إيقاف اشتراكك Pro. إذا كان هذا خطأً أو لديك استفسار، تواصل معنا.</p>
    </div>`,
    'set-admin': `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#f6c74d">تمت ترقيتك كمشرف في مؤثر برو ⚙️</h2>
      <p>يمكنك الآن الوصول إلى لوحة الإدارة الكاملة.</p>
    </div>`,
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'مؤثر برو <noreply@moatherpro.com>',
        to: [email],
        subject: subjects[action] || 'تحديث اشتراكك في مؤثر برو',
        html: bodies[action] || '',
      }),
    })
    await r.json().catch(() => ({}))
  } catch (e) {
    console.error('[resend] fetch failed:', e.message)
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

    if (action === 'grant-trial') {
      // Grant a 24-hour free trial — does NOT send email (user sees welcome popup on site)
      let findQuery = supabase.from('subscribers').select('id, email')
      if (id) {
        findQuery = findQuery.eq('id', id)
      } else if (email) {
        findQuery = findQuery.eq('email', email.toLowerCase().trim())
      } else {
        return res.status(400).json({ error: 'id or email required' })
      }
      const { data: sub, error: findErr } = await findQuery.single()
      if (findErr || !sub) return res.status(404).json({ error: 'Subscriber not found' })

      const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { error: updateErr } = await supabase
        .from('subscribers')
        .update({ plan: 'pro', expires_at: trialEnd, activated_at: new Date().toISOString(), reminder_sent_at: null })
        .eq('id', sub.id)
      if (updateErr) return res.status(500).json({ error: updateErr.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'activate' || action === 'set-admin') {
      let findQuery = supabase.from('subscribers').select('id, email')
      if (id) {
        findQuery = findQuery.eq('id', id)
      } else if (email) {
        findQuery = findQuery.eq('email', email.toLowerCase().trim())
      } else {
        return res.status(400).json({ error: 'id or email required' })
      }
      const { data: sub, error: findErr } = await findQuery.single()
      if (findErr || !sub) return res.status(404).json({ error: 'Subscriber not found' })

      // Clear expires_at so a former trial user gets a permanent subscription
      const updates = action === 'activate'
        ? { plan: 'pro', activated_at: new Date().toISOString(), expires_at: null }
        : { plan: 'admin', expires_at: null }

      const { error: updateErr } = await supabase
        .from('subscribers')
        .update(updates)
        .eq('id', sub.id)
      if (updateErr) return res.status(500).json({ error: updateErr.message })

      await sendPlanEmail(sub.email, action)
      return res.status(200).json({ ok: true })
    }

    if (action === 'revoke') {
      if (!id) return res.status(400).json({ error: 'id required' })

      const { data: sub } = await supabase
        .from('subscribers')
        .select('email')
        .eq('id', id)
        .single()

      const { error: updateErr } = await supabase
        .from('subscribers')
        .update({ plan: 'free' })
        .eq('id', id)
      if (updateErr) return res.status(500).json({ error: updateErr.message })

      await sendPlanEmail(sub?.email, 'revoke')
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).end()
}
