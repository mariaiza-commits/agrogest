// Service worker mínimo — só para PWA ser instalável
// Não faz cache de nada, não intercepta requisições
// Isso elimina todos os problemas de cache

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
