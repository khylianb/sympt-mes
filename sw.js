// Service worker : l'application fonctionne hors ligne.
// Incrémenter VERSION à chaque mise à jour du code pour rafraîchir le cache.
const VERSION = 'v2';
const CACHE = `symptmes-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/analysis.js',
  'js/catalogue.js',
  'js/demo.js',
  'js/config.js',
  'js/export.js',
  'js/settings.js',
  'js/store.js',
  'js/summary.js',
  'js/sync.js',
  'js/today.js',
  'js/ui.js',
  'js/util.js',
  'vendor/jspdf.umd.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Fichiers de l'appli : réseau d'abord (pour les mises à jour), cache si hors ligne.
// Les appels à Supabase (autre domaine) ne passent pas par ici.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
