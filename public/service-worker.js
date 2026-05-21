const CACHE_NAME = 'agrogestao-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
]

// Instala e faz cache dos arquivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Estratégia: Network first, cache fallback
self.addEventListener('fetch', event => {
  // Não faz cache de chamadas à API do Supabase
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva no cache se for GET bem sucedido
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline: usa cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Fallback para index.html (SPA)
          return caches.match('/index.html')
        })
      })
  )
})
