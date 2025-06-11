const CACHE_NAME = 'robot-mouth-v1';
const urlsToCache = ['/', 'styles.css', 'app.js', '/manifest.json'];

// Instalar Service Worker
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Retorna do cache se disponível, senão busca da rede
      return response || fetch(event.request);
    })
  );
});
