export interface Influencer {
  id: string
  name: string
  name_en?: string
  specialization?: string
  specialization_en?: string
  platform?: string
  followers: number
  avg_likes?: number
  avg_comments?: number
  engagement_rate?: number
  posts_per_week?: number
  profile_url?: string
  followers_ages?: Record<string, number>
  followers_gender?: { male: number; female: number }
  prices?: { story?: number; post?: number; reel?: number; video?: number }
  avatar_url?: string
  cover_url?: string
  gender?: string
  regions?: string[]
  regions_en?: string[]
  categories?: string[]
  categories_en?: string[]
  tags?: string[]
  tags_en?: string[]
  source?: string
  rank?: number
  verified?: boolean
  intro?: string
  intro_en?: string
}

const API_BASE = 'https://moatherpro.com'

function makeHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Origin: API_BASE,
    'Content-Type': 'application/json',
    'User-Agent': 'MoatherProApp/1.0',
  }
}

export async function activateUser(accessToken: string) {
  const res = await fetch(`${API_BASE}/api/activate`, {
    method: 'POST',
    headers: makeHeaders(accessToken),
  })
  if (!res.ok) throw new Error('activate failed')
  return res.json() as Promise<{ activated: boolean; plan: string }>
}

export async function fetchInfluencers(
  accessToken: string,
  page = 1,
  limit = 100,
) {
  const res = await fetch(
    `${API_BASE}/api/influencers?page=${page}&limit=${limit}`,
    { headers: makeHeaders(accessToken) },
  )
  if (!res.ok) throw new Error('fetch influencers failed')
  return res.json() as Promise<{
    data: Influencer[]
    total: number
    page: number
    limit: number
    hasMore: boolean
  }>
}

export async function fetchCount() {
  const res = await fetch(`${API_BASE}/api/count`, {
    headers: { Origin: API_BASE, 'User-Agent': 'MoatherProApp/1.0' },
  })
  if (!res.ok) return { count: 0 }
  return res.json() as Promise<{ count: number }>
}

export function getTier(followers: number): string {
  if (followers < 10_000) return 'نانو'
  if (followers < 100_000) return 'ميكرو'
  if (followers < 1_000_000) return 'ماكرو'
  if (followers < 5_000_000) return 'ميجا'
  return 'ألفا'
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function formatPrice(n?: number): string {
  if (!n) return '—'
  return `${n.toLocaleString('ar-SA')} ر.س`
}
