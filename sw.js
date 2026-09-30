/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — service worker

   القاعدة: أي تعديل من لوحة الإدارة لازم يوصل للناس بمجرد
   الرفريش. عشان كده:

     • الصفحة والكود والإعدادات  →  الشبكة أولاً (أحدث نسخة دايماً)
     • الصور والأيقونات          →  الكاش أولاً (مش بتتغير)
     • من غير نت                  →  آخر نسخة متخزنة تشتغل عادي
   ══════════════════════════════════════════════════════════════ */

const VERSION = 'nawah-v8';

/* يتخزنوا من أول زيارة عشان الشغل بدون إنترنت */
const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './i18n.js',
  './backend.js',
  './features.js',
  './extra.js',
  './community.js',
  './paper.js',
  './inbox.js',
  './paper.css',
  './vendor/html2canvas.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/qrcode.min.js',
  './config.json',
  './manifest.webmanifest',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

/* دي بس اللي ينفع تتقري من الكاش على طول */
const STATIC_RE = /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // خطوط جوجل وغيرها تعدي عادي

  /* الصور والخطوط: الكاش أولاً */
  if (STATIC_RE.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  /* كل الباقي (الصفحة · الكود · config.json): الشبكة أولاً */
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          const key = req.mode === 'navigate' ? './index.html' : req;
          caches.open(VERSION).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req.mode === 'navigate' ? './index.html' : req)
          .then((hit) => hit || Response.error())
      )
  );
});

/* الضغط على إشعار «طلب جديد» بيفتح الطلب نفسه في لوحة الإدارة */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = new URL(data.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.indexOf(self.registration.scope) === 0) {
        try { await c.focus(); } catch (err) {}
        if (data.no) c.postMessage({ type: 'open-req', no: data.no });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

/* إشعار «طلب جديد» جاي من السيرفر — بيوصل حتى لو الموقع مقفول */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: e.data ? e.data.text() : '' }; }
  const no = d.no || '';
  e.waitUntil((async () => {
    /* لو لوحة الإدارة مفتوحة قدامك دلوقتي، هي بتنبّه بصوتها — الإشعار هنا من غير صوت تاني */
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.some((c) => c.visibilityState === 'visible');
    const opts = {
      body: d.body || '',
      tag: no ? 'req-' + no : 'nawah-push',
      data: { no, url: d.url || './#admin' },
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      dir: 'rtl', lang: 'ar',
      requireInteraction: !!d.urgent
    };
    if (visible) opts.silent = true;                 // الإشعار الصامت ممنوع يبقى معاه اهتزاز
    else opts.vibrate = d.urgent ? [300, 120, 300, 120, 500, 120, 300] : [220, 100, 220, 100, 220];
    try { await self.registration.showNotification(d.title || 'طلب صيانة جديد', opts); }
    catch (err) { await self.registration.showNotification(d.title || 'طلب صيانة جديد', { body: opts.body, tag: opts.tag, data: opts.data }); }
    wins.forEach((c) => c.postMessage({ type: 'push-new', no }));
  })());
});
