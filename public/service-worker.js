const CACHE_NAME = 'agrogestao-v4'

self.addEventListener('install', event => {
  // Ativa imediatamente sem esperar o SW antigo fechar
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Avisa todos os clientes abertos para recarregar com a versão nova
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }))
        })
      })
  )
})

self.addEventListener('fetch', event => {
  const url = event.request.url

  if (url.includes('supabase.co')) return
  if (url.startsWith('chrome-extension://')) return
  if (event.request.method !== 'GET') return

  // index.html: SEMPRE da rede — garante versão nova a cada reload
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
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()))
          }
          return response
        })
      })
    )
    return
  }

  // Demais recursos: rede primeiro, cache como fallback offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
