import { Influencer } from './api'

const _cache = new Map<string, Influencer>()

export function cacheInfluencer(inf: Influencer) {
  _cache.set(String(inf.id), inf)
}

export function getCachedInfluencer(id: string): Influencer | null {
  return _cache.get(id) ?? null
}
