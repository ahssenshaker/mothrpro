import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300') // cache 5 min
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const { count, error } = await supabase
      .from('influencers')
      .select('id', { count: 'exact', head: true })
    if (error) return res.status(500).json({ count: 0 })
    return res.status(200).json({ count: count || 0 })
  } catch {
    return res.status(500).json({ count: 0 })
  }
}

export const config = { api: { bodyParser: false } }
