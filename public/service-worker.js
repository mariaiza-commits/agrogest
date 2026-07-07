// Cache-first para assets estáticos (JS/CSS com hash no nome).
// Network-only para HTML e chamadas de API (Supabase).

const CACHE = 'ag-static-v2'
const STATIC = /\.(js|css|woff2?|png|ico|svg|webp)$/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', async () => {
  const keys = await caches.keys()
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  await self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (!STATIC.test(url.pathname)) return

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone())
          return response
        }).catch(() => cached)
      })
    )
  )
})
