/* BodyMap Pain — Service Worker (PWA offline-first)
 * الاستراتيجية:
 *  - طلبات التنقّل (فتح التطبيق / index.html): network-first حتى لا يعلق
 *    المستخدم على نسخة قديمة بعد كل تحديث، مع الرجوع للكاش عند عدم الاتصال.
 *  - الأصول الثابتة (JS/CSS/الصور ذات بصمة في الاسم): cache-first لأنها لا تتغير.
 * كل المسارات نسبية (base) حتى يعمل التطبيق تحت أي مسار فرعي.
 */
const BASE = self.location.pathname.replace(/service-worker\.js$/, '');
const CACHE = 'bodymap-pain-v3';
const INDEX = BASE + 'index.html';
const CORE = [BASE, INDEX, BASE + 'manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) التنقّل وصفحة HTML: شبكة أولاً (حتى لا تعلق على نسخة قديمة).
  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(INDEX, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(INDEX).then((cached) => cached || caches.match(BASE))),
    );
    return;
  }

  // 2) الأصول الثابتة: cache-first مع تحديث في الخلفية.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
