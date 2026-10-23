// Service worker : l'application fonctionne hors ligne.
// Incrémenter VERSION à chaque mise à jour du code pour rafraîchir le cache.
const VERSION = 'v48';
const CACHE = `symptmes-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/backup.js',
  'js/boss.js',
  'js/care.js',
  'js/changelog.js',
  'js/config.js',
  'js/game.js',
  'js/game-shop.js',
  'js/games.js',
  'js/levels.js',
  'js/mascot.js',
  'js/pet.js',
  'js/pet-art.js',
  'js/run.js',
  'js/run-3d.js',
  'js/settings.js',
  'js/store.js',
  'js/sync.js',
  'js/ui.js',
  'js/util.js',
  'js/wallet.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];
// Gros fichiers 3D d'Axolo Run : cache à part, gardé d'une version à l'autre (changer le nom du fichier
// ou CACHE_3D pour les remplacer). Téléchargés en arrière-plan, sans bloquer l'installation.
const CACHE_3D = 'symptmes-3d-v1';
const FILES_3D = ['vendor/three.module.js', ...['decor', 'fish1', 'fish2', 'fish3', 'whale', 'mantaray', 'dolphin'].map((n) => `models/${n}.glb`)];
const is3d = (url) => FILES_3D.some((f) => url.pathname.endsWith('/' + f));

function prefetch3d() {
  return caches.open(CACHE_3D).then((c) => Promise.all(FILES_3D.map((f) => c.match(f).then((hit) => hit || c.add(f))))).catch(() => {});
}

self.addEventListener('install', (e) => {
  prefetch3d();
  // cache: 'reload' : ne jamais reprendre une ancienne copie gardée par le navigateur (GitHub Pages les garde 10 min)
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CACHE_3D).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Fichiers de l'appli : réseau d'abord (pour les mises à jour), cache si hors ligne.
// Les appels à Supabase (autre domaine) ne passent pas par ici.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Polices Google : cache d'abord (elles ne changent pas)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Fichiers 3D : cache d'abord (ils ne changent pas)
  if (is3d(url)) {
    e.respondWith(caches.open(CACHE_3D).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(
    // no-cache : on redemande toujours au serveur s'il y a plus récent (réponse légère si rien n'a changé)
    fetch(e.request, { cache: 'no-cache' })
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
