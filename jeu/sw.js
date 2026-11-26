/*
 * Service worker : garde le jeu en mémoire sur le téléphone pour qu'il marche
 * sans connexion. Stratégie « cache puis réseau » : on répond tout de suite avec
 * la version en cache et on la met à jour en arrière-plan (la nouvelle version
 * est utilisée au lancement suivant).
 */
const CACHE = 'piano-jeu-v1';
const ASSETS = [
  './',
  'index.html',
  'jeu.css',
  'exercices.js',
  'jeu.js',
  'manifest.webmanifest',
  'icones/icone.svg',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/apple-touch-icon.png',
  '../js/glyphes.js',
  '../js/musique.js',
  '../js/dessin.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const network = fetch(event.request)
      .then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => cached);
    event.waitUntil(network.catch(() => {}));
    return cached || network;
  }));
});
