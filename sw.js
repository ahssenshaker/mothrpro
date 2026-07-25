const CACHE = 'moatherpro-v1'

const SHELL = [
  '/',
  '/landing',
  '/manifest.json',
]

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and cross-origin supabase/external requests
  if (request.method !== 'GET') return
  if (url.hostname !== self.location.hostname && !url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/api/')) {
    // Network first for API — fresh data always preferred
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    // Cache first for images — long TTL
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
          return res
        })
      }),
    )
    return
  }

  // Network first with cache fallback for HTML pages
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request) || caches.match('/')),
  )
})
