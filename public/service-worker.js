const CACHE_NAME = 'agrogestao-v5'

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' })
        .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
      )
  )
})

self.addEventListener('fetch', event => {
  const url = event.request.url

  if (url.includes('supabase.co')) return
  if (url.startsWith('chrome-extension://')) return
  if (event.request.method !== 'GET') return

  // index.html: sempre da rede
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Arquivos com hash (/static/): cache permanente
  if (url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          const clone = response.clone() // clone ANTES de qualquer uso assíncrono
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // Demais recursos: rede primeiro, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone() // clone ANTES de qualquer uso assíncrono
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
