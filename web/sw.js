// Service worker: statické soubory z cache (aplikace se otevře i bez signálu), na pozadí se obnovují.
// Při každé změně ve web/ zvyš VERZE (a stejnou v js/verze.js) – stará cache se pak smaže.
const VERZE = '0.3.0';
const CACHE = 'aplikace-cs-' + VERZE;

const SOUBORY = [
  './',
  './index.html',
  './manifest.webmanifest',
  './config.js',
  './css/app.css',
  './js/app.js',
  './js/api.js',
  './js/db.js',
  './js/diagnostika.js',
  './js/expirace.js',
  './js/fotky.js',
  './js/fronta.js',
  './js/podniky.js',
  './js/skener.js',
  './js/ui.js',
  './js/uloziste.js',
  './js/verze.js',
  './js/zaznamy.js',
  './js/obrazovky/prihlaseni.js',
  './js/obrazovky/rozcestnik.js',
  './js/obrazovky/expirace-domu.js',
  './js/obrazovky/kontrola-lokace.js',
  './js/obrazovky/moje-ukoly.js',
  './js/obrazovky/blizi-se.js',
  './js/obrazovky/pc-ukoly.js',
  './js/pc.js',
  './ikony/ikona-192.png',
  './ikony/ikona-512.png',
  './ikony/ikona-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SOUBORY.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((klice) => Promise.all(klice
        .filter((k) => k.startsWith('aplikace-cs-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // API (POST na Apps Script) a cizí adresy jdou vždy přímo na síť.
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  const klic = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const ulozena = await cache.match(klic, { ignoreSearch: true });
    const zeSite = fetch(req)
      .then((odp) => {
        if (odp.ok && !odp.redirected && odp.type === 'basic') cache.put(klic, odp.clone());
        return odp;
      })
      .catch(() => null);
    if (ulozena) {
      e.waitUntil(zeSite);
      return ulozena;
    }
    return (await zeSite) || new Response('Bez připojení', { status: 503 });
  })());
});
