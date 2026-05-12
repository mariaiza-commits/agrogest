const CACHE_NAME = 'agrogestao-v1'
const OFFLINE_URL = '/offline.html'

// Arquivos para cachear na instalação
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
]

// Instala e cacheia os arquivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignora erros de cache individual
        return Promise.resolve()
      })
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

// Intercepta requisições
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Supabase — deixa passar (não cacheia dados do banco)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se falhar e for uma requisição de dados, retorna erro indicando offline
        return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão com o servidor' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        })
      })
    )
    return
  }

  // Para os arquivos do app — tenta rede primeiro, fallback para cache
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        // Guarda no cache se for bem sucedido
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached || caches.match('/offline.html'))

      // Retorna cache imediato se existir, senão espera a rede
      return cached || networkFetch
    })
  )
})

// Background Sync — sincroniza dados offline quando voltar internet
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingData())
  }
})

async function syncPendingData() {
  // Notifica os clientes para fazer a sincronização
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_PENDING' })
  })
}

// Recebe mensagens do app
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
