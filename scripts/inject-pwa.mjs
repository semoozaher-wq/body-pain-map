// scripts/inject-pwa.mjs
// ============================================================================
// يحقن وسوم PWA (manifest, theme-color, apple meta, service worker) في
// dist/index.html بعد `expo export --platform web`.
// يعمل تلقائيًا عبر `npm run build:web`.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'dist/index.html');
if (!existsSync(file)) {
  console.error('[inject-pwa] dist/index.html غير موجود — شغّل expo export أولًا.');
  process.exit(1);
}

let html = readFileSync(file, 'utf8');

const HEAD_TAGS = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0E6972" />
    <meta name="description" content="BodyMap Pain — تطبيق تعليمي لتسجيل الألم وفهم تاريخك الشخصي، يعمل دون إنترنت." />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="BodyMap Pain" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />`;

const SW_SCRIPT = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/service-worker.js').catch(function () {});
        });
      }
    </script>`;

// احقن وسوم الرأس قبل </head> إن لم تكن موجودة.
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${HEAD_TAGS}\n  </head>`);
}

// احقن تسجيل الـ service worker قبل </body>.
if (!html.includes('serviceWorker.register')) {
  html = html.replace('</body>', `${SW_SCRIPT}\n  </body>`);
}

writeFileSync(file, html, 'utf8');
console.log('[inject-pwa] تم حقن وسوم PWA بنجاح في dist/index.html');
