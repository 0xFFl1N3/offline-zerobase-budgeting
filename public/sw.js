// Offline support for the installed app. It only caches the app's own files; budget data lives in
// the browser's database and never passes through here.
//
// Pages: network first, so a new version shows up as soon as you are online; the cached copy when offline.
// Scripts, styles and icons: cache first (their file names change with every build).
const CACHE = 'budget-app-v1';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** After a new page arrives, drops built files it no longer uses so old versions don't pile up. */
async function pruneAssets(html) {
  const cache = await caches.open(CACHE);
  const used = new Set([...html.matchAll(/assets\/[^"')\s]+/g)].map((m) => m[0]));
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    const match = path.match(/assets\/[^/]+$/);
    if (match && !used.has(match[0])) await cache.delete(request);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('./', response.clone());
            event.waitUntil(response.clone().text().then(pruneAssets));
          }
          return response;
        } catch {
          return (await caches.match('./')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    })(),
  );
});
