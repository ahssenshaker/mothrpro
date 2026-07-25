import { createClient } from '@supabase/supabase-js'
import { resolveIsAdmin } from './_auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const isAdmin = await resolveIsAdmin(req.headers.authorization)
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  // Delete auth user first — the subscribers row cascades automatically via ON DELETE CASCADE.
  // Deleting subscribers first risks orphaning it if the auth delete then fails.
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: true } }
