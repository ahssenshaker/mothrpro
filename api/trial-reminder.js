import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function sendReminderEmail(email, expiresAt) {
  const key = process.env.RESEND_API_KEY
  if (!key || !email) return

  const hoursLeft = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 3_600_000))

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'مؤثر برو <noreply@moatherpro.com>',
        to: [email],
        subject: `⏰ تجربتك المجانية تنتهي خلال ${hoursLeft} ساعة`,
        html: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="color:#f6c74d;margin-bottom:8px">⏰ تجربتك المجانية توشك على الانتهاء</h2>
          <p style="color:#94a3b8;line-height:1.7;margin-bottom:20px">
            تجربتك المجانية في <strong style="color:#e2e8f0">مؤثر برو Pro</strong>
            ستنتهي خلال <strong style="color:#63b3ed">${hoursLeft} ساعة</strong>.
            اشترك الآن للاستمرار في الوصول الكامل.
          </p>
          <div style="background:#131c2e;border-radius:12px;padding:16px 20px;margin-bottom:20px">
            <p style="color:#e2e8f0;font-weight:700;margin-bottom:10px">مميزات الاشتراك Pro:</p>
            <ul style="color:#94a3b8;line-height:2.2;padding-right:20px;margin:0">
              <li>✅ أسعار الإعلانات الفعلية لجميع المؤثرين</li>
              <li>✅ نسب التفاعل والإحصائيات الكاملة</li>
              <li>✅ روابط منصات التواصل الاجتماعي</li>
              <li>✅ الوصول لأكثر من ${process.env.INFLUENCER_COUNT || '1000'}+ مؤثر</li>
              <li>✅ تصدير البيانات بصيغة CSV</li>
            </ul>
          </div>
          <a href="https://moatherpro.com"
             style="display:inline-block;background:linear-gradient(135deg,#63b3ed,#f6c74d);color:#07090f;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            اشترك الآن في مؤثر برو
          </a>
          <p style="color:#475569;font-size:11px;margin-top:24px;line-height:1.6">
            تصلك هذه الرسالة لأنك سجّلت في مؤثر برو. يمكنك تجاهلها إذا لم تكن مهتماً بالاستمرار.
          </p>
        </div>`,
      }),
    })
    console.log('[trial-reminder] Email sent to:', email)
  } catch (e) {
    console.error('[trial-reminder] Email failed for', email, ':', e.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  // Vercel sets Authorization: Bearer {CRON_SECRET} on all cron invocations.
  // If CRON_SECRET is configured, reject any call that doesn't carry it.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  // Look for trials expiring in 5–7 hours that haven't had a reminder sent yet.
  // Running hourly, this window fires exactly once per trial (no duplicates).
  const now = Date.now()
  const windowStart = new Date(now + 5 * 3_600_000).toISOString()
  const windowEnd   = new Date(now + 7 * 3_600_000).toISOString()

  const { data: expiring, error } = await supabase
    .from('subscribers')
    .select('id, email, expires_at')
    .eq('plan', 'pro')
    .not('expires_at', 'is', null)
    .gte('expires_at', windowStart)
    .lte('expires_at', windowEnd)
    .is('reminder_sent_at', null)

  if (error) {
    console.error('[trial-reminder] Query error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  const reminded = []
  for (const sub of expiring || []) {
    await sendReminderEmail(sub.email, sub.expires_at)
    await supabase
      .from('subscribers')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', sub.id)
    reminded.push(sub.email)
  }

  console.log(`[trial-reminder] Done — ${reminded.length} reminder(s) sent`)
  return res.status(200).json({ ok: true, count: reminded.length })
}
