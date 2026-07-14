// KineApp / Kinesico Sport — Service Worker (PWA)
// Estrategia: network-first para los archivos propios (evita versiones viejas),
// con fallback a caché para que la app abra offline. Los CDN (Supabase, jsPDF)
// van directo a la red (no se cachean acá).

const CACHE = 'kineapp-v11';  // ⬆ subir este número en cada cambio fuerza que el PWA se actualice
const SHELL = [
  './', './index.html',
  './assets/css/styles.css',
  './assets/js/config.js', './assets/js/store.js', './assets/js/icons.js', './assets/js/pdf.js', './assets/js/app.js',
  './manifest.webmanifest', './assets/icon.svg',
];

self.addEventListener('install', e => {
  // Precache tolerante: si un archivo falla, no se anula todo el precache.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // CDN / APIs externas -> red directa
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })   // siempre revalidar con el servidor (evita quedar pegado en una versión vieja)
      .then(resp => {
        // Solo cacheamos respuestas OK (no 404/500/206/redirect) para no envenenar la caché.
        if (resp && resp.ok && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
