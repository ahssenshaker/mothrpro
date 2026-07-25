import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Resolves the authenticated user if they have admin plan; returns user object or null.
export async function resolveAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return null
    const { data: sub } = await supabase
      .from('subscribers')
      .select('plan')
      .eq('id', user.id)
      .single()
    return sub?.plan === 'admin' ? user : null
  } catch {
    return null
  }
}

// Returns true if the request carries a valid admin JWT; false otherwise.
export async function resolveIsAdmin(authHeader) {
  return !!(await resolveAdmin(authHeader))
}
