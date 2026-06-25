const CACHE_NAME = 'agrogestao-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
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

// Ativa e limpa caches de versões anteriores
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
  const url = event.request.url

  // Não intercepta chamadas ao Supabase, extensões do Chrome ou não-GET
  if (url.includes('supabase.co')) return
  if (url.startsWith('chrome-extension://')) return
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Para navegação SPA, retorna index.html do cache
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          // Para outros recursos offline, mostra página offline
          return caches.match('/offline.html')
        })
      })
  )
})
