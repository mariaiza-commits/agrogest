// Service worker mínimo — só para PWA ser instalável
// Passa TUDO direto para a rede, sem cache nenhum

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', async () => {
  // Limpa todos os caches de versões antigas
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  await self.clients.claim()
})

// Deixa TODAS as requisições ir direto para a rede
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request))
})
