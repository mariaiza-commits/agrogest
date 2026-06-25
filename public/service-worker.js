const CACHE_NAME = 'agrogestao-v3'

// Só cacheia assets estáticos com hash (JS/CSS) — NUNCA o index.html
self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = event.request.url

  // Ignora chamadas ao Supabase, extensões e não-GET
  if (url.includes('supabase.co')) return
  if (url.startsWith('chrome-extension://')) return
  if (event.request.method !== 'GET') return

  // index.html: SEMPRE busca da rede (nunca serve do cache)
  // Isso garante que o app atualiza ao recarregar
  if (event.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Arquivos JS/CSS com hash: cache permanente (são únicos por versão)
  if (url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Outros recursos: rede primeiro, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
