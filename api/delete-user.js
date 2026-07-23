import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function resolveIsAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return false
    const { data: sub } = await supabase.from('subscribers').select('plan').eq('id', user.id).single()
    return sub?.plan === 'admin'
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const isAdmin = await resolveIsAdmin(req.headers.authorization)
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  await supabase.from('subscribers').delete().eq('id', userId)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: true } }
