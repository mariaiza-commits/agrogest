// Network-only: todas as requisições vão direto para a rede.
// Mantido simples para evitar conflitos com lazy loading de chunks JS.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  await self.clients.claim()
})

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request))
})
