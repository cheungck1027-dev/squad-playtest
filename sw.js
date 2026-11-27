// 千門戰姬 service worker（由 tools/build.mjs 生成，唔好手改）。版本 c39a118aa8
// 成個版本一個快取：安裝時落晒 CORE（等齊先算裝好）；有舊版行緊就等玩家喺遊戲入面答應先接手（唔會一半新一半舊）；其餘模型（REST）開咗遊戲之後喺背景落。
// 全部用相對路徑：放喺網站根目錄或者子目錄都得。
const VERSION = "c39a118aa8", CACHE = 'number-squad-' + VERSION;
const CORE = ["index.html","app.js","manifest.webmanifest","assets/akari-avatar.webp","assets/fonts/pg-serif.woff2","assets/gen-avatar.webp","assets/homura-avatar.webp","assets/hotaru-avatar.webp","assets/icons/apple-touch-180.png","assets/icons/favicon-48.png","assets/icons/icon-192.png","assets/icons/icon-512.png","assets/icons/maskable-512.png","assets/key-visual.webp","assets/kiri-avatar.webp","assets/leader-avatar.webp","assets/leader-cutin.webp","assets/logo.webp","assets/models/arms-pose.glb","assets/models/barrier.glb","assets/models/boss.glb","assets/models/brick.glb","assets/models/gate.glb","assets/models/grunt-d.glb","assets/models/grunt.glb","assets/models/leader-v3.glb","assets/models/prize.glb","assets/models/w-rifle.glb","assets/station-command.webp","assets/station-signal.webp","assets/station-workshop.webp","assets/supply-atlas.webp","assets/suzu-avatar.webp","assets/tate-avatar.webp"];
const REST = ["assets/akari-bust.webp","assets/akari-card.webp","assets/chapters/ch-a.webp","assets/chapters/ch-b.webp","assets/chapters/ch-c.webp","assets/chapters/ch-d.webp","assets/chapters/ch-e.webp","assets/gen-bust.webp","assets/gen-card.webp","assets/homura-bust.webp","assets/homura-card.webp","assets/hotaru-bust.webp","assets/hotaru-card.webp","assets/kiri-bust.webp","assets/kiri-card.webp","assets/leader-bust.webp","assets/leader-card.webp","assets/models/akari-v3.glb","assets/models/gen.glb","assets/models/homura.glb","assets/models/hotaru.glb","assets/models/kiri-v3.glb","assets/models/suzu-v3.glb","assets/models/tate-v3.glb","assets/models/w-drone.glb","assets/models/w-lantern.glb","assets/models/w-launcher.glb","assets/models/w-pistol-mint.glb","assets/models/w-pistol.glb","assets/models/w-shotgun.glb","assets/models/w-sniper.glb","assets/models/w-spear.glb","assets/models/w-sword.glb","assets/suzu-bust.webp","assets/suzu-card.webp","assets/tate-bust.webp","assets/tate-card.webp"];
self.addEventListener('install', (ev) => { ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', (ev) => { ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('number-squad-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (ev) => {
  if (ev.data === 'skip') self.skipWaiting();
  if (ev.data === 'warm') ev.waitUntil(caches.open(CACHE).then(async (c) => { for (const u of REST) { try { if (!(await c.match(u))) await c.add(new Request(u, { cache: 'reload' })); } catch (e) { /* 落唔到就下次再試 */ } } }));
});
self.addEventListener('fetch', (ev) => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  ev.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.startsWith(new URL('./', self.location).pathname)) c.put(req, res.clone());
    return res;
  }));
});
