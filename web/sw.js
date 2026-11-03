// Service Worker: alles offline verfügbar. Relative Pfade (die Seite liegt unter /<repo>/).
// Der Cache-Name enthält die Build-Version (wird von werkzeuge/web-bauen.mjs eingesetzt); alte Caches werden gelöscht.
const CACHE = 'schau-werkstatt-__VERSION__';
const DATEIEN = ['./', 'index.html', 'app.css', 'app.js', 'daten.js', 'kern/bilder.js', 'kern/symbole.js', 'manifest.webmanifest',
  'icons/symbol.svg', 'icons/symbol-180.png', 'icons/symbol-192.png', 'icons/symbol-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  // Zuerst aus dem Cache (offline), ohne Anfrage-Teil nach # oder ?
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
