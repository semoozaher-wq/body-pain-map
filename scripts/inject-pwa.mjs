// scripts/inject-pwa.mjs
// ============================================================================
// يعمل بعد `expo export --platform web`:
//  1) يحقن وسوم PWA (manifest, theme-color, apple meta, service worker).
//  2) يحوّل كل المسارات المطلقة إلى نسبية حتى يعمل التطبيق عند نشره على أي
//     مسار فرعي (مثل sites.super.myninja.ai/<account>/<hash>/index.html)
//     بدون أن تتعطّل الأصول (كانت تُطلب من جذر النطاق فتُرجع 403).
// يعمل تلقائيًا عبر `npm run build:web`.
// ============================================================================
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const file = resolve(root, 'dist/index.html');
if (!existsSync(file)) {
  console.error('[inject-pwa] dist/index.html غير موجود — شغّل expo export أولًا.');
  process.exit(1);
}

let html = readFileSync(file, 'utf8');

const HEAD_TAGS = `
    <link rel="manifest" href="./manifest.json" />
    <meta name="theme-color" content="#0E6972" />
    <meta name="description" content="BodyMap Pain — تطبيق تعليمي لتسجيل الألم وفهم تاريخك الشخصي، يعمل دون إنترنت." />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="BodyMap Pain" />
    <link rel="apple-touch-icon" href="./icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png" />`;

// نسجّل الـ service worker بمسار نسبي حتى يعمل تحت أي مسار فرعي.
const SW_SCRIPT = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('./service-worker.js').catch(function () {});
        });
      }
    </script>`;

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${HEAD_TAGS}\n  </head>`);
}
if (!html.includes('serviceWorker.register')) {
  html = html.replace('</body>', `${SW_SCRIPT}\n  </body>`);
}

// حوّل المسارات المطلقة في index.html إلى نسبية (href="/x" و src="/x").
html = html.replace(/(href|src)="\//g, '$1="./');

writeFileSync(file, html, 'utf8');

// حوّل مسارات الأصول داخل حزمة JS من "/assets/..." إلى "./assets/..."
// (تُحلّ نسبةً إلى صفحة المستند، فتعمل تحت أي مسار فرعي).
const jsDir = resolve(root, 'dist/_expo/static/js/web');
let patched = 0;
let bundleHash = '';
if (existsSync(jsDir)) {
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith('.js')) continue;
    const p = join(jsDir, name);
    const src = readFileSync(p, 'utf8');
    const next = src.replace(/"\/assets\//g, '"./assets/');
    if (next !== src) {
      writeFileSync(p, next, 'utf8');
      patched += 1;
    }
    bundleHash = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10);
  }
}

// أضف ?v=<hash> لرابط الحزمة لضمان عدم استخدام نسخة قديمة مخزّنة مؤقتًا.
if (bundleHash) {
  html = html.replace(/(src="\.\/_expo\/static\/js\/web\/[^"]+\.js)"/g, `$1?v=${bundleHash}"`);
  writeFileSync(file, html, 'utf8');
}

console.log(`[inject-pwa] تم حقن وسوم PWA وتحويل المسارات إلى نسبية (حزم JS معدّلة: ${patched} · v=${bundleHash}).`);
