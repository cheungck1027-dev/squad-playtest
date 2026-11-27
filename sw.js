// 千門戰姬 service worker（由 tools/build.mjs 生成，唔好手改）。版本 5df8a71c9e
// 安裝時驗完所有基本檔案先接手，其他素材按需下載。
// 全部用相對路徑：放喺網站根目錄或者子目錄都得。
const VERSION = "5df8a71c9e", CACHE = 'number-squad-' + VERSION;
const CORE = ["index.html","app.js","manifest.webmanifest","assets/akari-avatar.webp","assets/chapters/battle-dusk.webp","assets/chapters/ruin-facade.webp","assets/fonts/pg-serif.woff2","assets/gen-avatar.webp","assets/homura-avatar.webp","assets/hotaru-avatar.webp","assets/icons/apple-touch-180.png","assets/icons/favicon-48.png","assets/icons/icon-192.png","assets/icons/icon-512.png","assets/icons/maskable-512.png","assets/key-visual.webp","assets/kiri-avatar.webp","assets/leader-avatar.webp","assets/leader-cutin.webp","assets/logo.webp","assets/models/arms-pose.glb","assets/models/barrier.glb","assets/models/boss.glb","assets/models/brick.glb","assets/models/gate.glb","assets/models/grunt-d.glb","assets/models/grunt.glb","assets/models/leader-v3.glb","assets/models/prize.glb","assets/models/w-rifle.glb","assets/station-command.webp","assets/station-signal.webp","assets/station-workshop.webp","assets/supply-atlas.webp","assets/suzu-avatar.webp","assets/tate-avatar.webp"];
const REST = ["assets/akari-bust.webp","assets/akari-card.webp","assets/chapters/ch-a.webp","assets/chapters/ch-b.webp","assets/chapters/ch-c.webp","assets/chapters/ch-d.webp","assets/chapters/ch-e.webp","assets/gen-bust.webp","assets/gen-card.webp","assets/homura-bust.webp","assets/homura-card.webp","assets/hotaru-bust.webp","assets/hotaru-card.webp","assets/kiri-bust.webp","assets/kiri-card.webp","assets/leader-bust.webp","assets/leader-card.webp","assets/models/akari-v3.glb","assets/models/gen.glb","assets/models/homura.glb","assets/models/hotaru.glb","assets/models/kiri-v3.glb","assets/models/suzu-v3.glb","assets/models/tate-v3.glb","assets/models/w-drone.glb","assets/models/w-lantern.glb","assets/models/w-launcher.glb","assets/models/w-pistol-mint.glb","assets/models/w-pistol.glb","assets/models/w-shotgun.glb","assets/models/w-sniper.glb","assets/models/w-spear.glb","assets/models/w-sword.glb","assets/suzu-bust.webp","assets/suzu-card.webp","assets/tate-bust.webp","assets/tate-card.webp"];
const hashes = {"index.html":"sha256-Gs+5tye/5R8ooMj5U45P4sOKNnH7Xk6m1wFMmx7qhvA=","app.js":"sha256-EFeuxJScgVWFMnh4xYToVJapuuHwtab5WKESoA1rQtw=","manifest.webmanifest":"sha256-zw4wiaamWEcEfKmdch8luPgalW4BAepQnRKPq5AK33Q=","assets/akari-avatar.webp":"sha256-xCbMOanE1LEWf1bgR/aMIzqsrnNJQeeiWJNCjwNkMa0=","assets/chapters/battle-dusk.webp":"sha256-civedbkEqjw70lUWguT1eJIAlpU5PD8mQOlYXdf3IW0=","assets/chapters/ruin-facade.webp":"sha256-pN35LuU1+ISdxkBe6YOu4n4I1geT1p3GSYSknGCV/Yg=","assets/fonts/pg-serif.woff2":"sha256-aTex08TR7j2TLyXuENXpboJ6yZ7wtaxdqG7Xxikmc08=","assets/gen-avatar.webp":"sha256-MmMLFFnwgvi+AY0yhlB+VI9aSBhnC23+Im0rNAL+MEs=","assets/homura-avatar.webp":"sha256-m1uEcTTovrZyo1E232HbeVH5F7EHWGLaHvLTMwjVuq0=","assets/hotaru-avatar.webp":"sha256-+0m89Cnm3kJ+IujiY9GV3ethiGrox51yuKN27zZbkhw=","assets/icons/apple-touch-180.png":"sha256-+VWyHtJKB3U0U0uyVutKB2LUC/Grc8HGB76dEAaqo/Y=","assets/icons/favicon-48.png":"sha256-NXKmSrKx76s+H3v0qcLgDrlNSEXIvKKtPNa/V4z81W4=","assets/icons/icon-192.png":"sha256-4en55leTXPzaxGQFs3jD0M3a88zg+QFFtHELW8IQkRY=","assets/icons/icon-512.png":"sha256-x1Fan1Nd3FJ/miE7GnuBxU4BHn3lkzQdzbNB9sbQnno=","assets/icons/maskable-512.png":"sha256-8dL/ftRlNZjEGabp5/5KTbbjxW/tH8lrQkjHqLkGPUc=","assets/key-visual.webp":"sha256-dUWUcX4xiIeJR2SBuoewgX236m8ROReJJhRnBHTwbEM=","assets/kiri-avatar.webp":"sha256-l3UEC7+u/4dFqk/6GQx1gUjs2CTMC5cZtJhPW1EaRoQ=","assets/leader-avatar.webp":"sha256-XnBb+9EjeDj+U4pmmUgdCZtX/7I4vIZ7Lu/X+2m6hew=","assets/leader-cutin.webp":"sha256-kEaG1lvsBI9QrKs3Ui65NKB11VaNuupTDizDFPRFPMc=","assets/logo.webp":"sha256-RrV/ouwHDbyPzaVJYF2+e23Itx74wlCQD15HZlFu6pM=","assets/models/arms-pose.glb":"sha256-85tyCh+AJoGE6Use2Vjpu++gP2jiCflxD0BwbsSE7pc=","assets/models/barrier.glb":"sha256-YDOhq3COS3D/MYlSSHD+ta0cOtzZhvilscnZesX6WaE=","assets/models/boss.glb":"sha256-onZ6dihRniQHjk8d664l+fiMfRLlR6roT5pxruUrAmE=","assets/models/brick.glb":"sha256-s84h6Eybu77x39nMsMmVl8Ueu82ZDI15T1hh4c5EIa8=","assets/models/gate.glb":"sha256-klz7PS0FcIkqjvEc81nfUztZ941crc7naVLc1GLHuco=","assets/models/grunt-d.glb":"sha256-D1sxRhzQQpFNg54I0rq+3D1u+ZLxOTOPKJTLOehRgVk=","assets/models/grunt.glb":"sha256-c2PIUwFsXvgiaUI1RwOApsXacGg0pW/WzuchoxPuDe4=","assets/models/leader-v3.glb":"sha256-XbrN7MfrC12HC4fyY79OtWHbn5X9YVJpcBO2bEm7zqI=","assets/models/prize.glb":"sha256-USFN+/224YwxcHa5PXgmSzipDJxPzTaeRUznb3U+cKc=","assets/models/w-rifle.glb":"sha256-7dJ8VI8+wNi3Q98VXIopXUdMVKboMBb32up7Zgljj08=","assets/station-command.webp":"sha256-09lMDvaKTFFPuUwxl5f4aajLa0axqmpxc85TRY646VM=","assets/station-signal.webp":"sha256-xuwLP6uzs2MBbFwQVbBF1UxSz8K3fYfhbDlaI66nxIk=","assets/station-workshop.webp":"sha256-5mtieeWvU0gP8mIbwWP5e1EQIWxcxN2ES+ro+gR6TSU=","assets/supply-atlas.webp":"sha256-aUT6Rj9YbxeI+88oX5VDAwJ6I3CCud9SoSscevOpliE=","assets/suzu-avatar.webp":"sha256-O9F47RkCzxr41dUTHA4/XypynRlRWTVc+/K1JZVFX0E=","assets/tate-avatar.webp":"sha256-G0ynzWnn2Jm8m7vU+yfZcjKz4tisxLOQsa3E0NuwgTc="};
const requested = new URL(self.location.href).searchParams.get('v');
const scope = self.registration.scope;
const marker = new URL('version.json', scope).pathname;
const assetPath = new URL('assets/', scope).pathname;
function releaseAsset(req) {
  const url = new URL(req.url);
  url.searchParams.set('v', VERSION);
  return fetch(new Request(url, req));
}
self.addEventListener('install', ev => ev.waitUntil((async () => {
  if (requested && requested !== VERSION) throw new Error('Release changed during installation');
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE.map(f => new Request(f + '?v=' + VERSION, { cache: 'no-store', integrity: hashes[f] })));
  await self.skipWaiting();
})()));
self.addEventListener('activate', ev => ev.waitUntil((async () => {
  await self.clients.claim();
  // The old, unversioned worker served a cached launch page that had no version check.
  // Move only those game windows to this launch screen once, including installed home-screen apps.
  if (!requested) {
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      const path = new URL(client.url).pathname;
      if (path === new URL(scope).pathname || path === new URL('index.html', scope).pathname) client.navigate(client.url).catch(() => {});
    }
  }
  for (const key of await caches.keys()) if (key.startsWith('number-squad-') && key !== CACHE) await caches.delete(key);
})()));
self.addEventListener('message', (ev) => {
  if (ev.data === 'warm') ev.waitUntil(caches.open(CACHE).then(async (c) => {
    for (const u of REST) {
      try {
        if (await c.match(u)) continue;
        const res = await releaseAsset(new Request(new URL(u, scope)));
        if (res.status === 200) await c.put(u, res);
      } catch { /* 下次開遊戲再試 */ }
    }
  }));
});
self.addEventListener('fetch', (ev) => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(scope).pathname)) return;
  if (url.pathname === marker) { ev.respondWith(fetch(req, { cache: 'no-store' })); return; }
  if (url.pathname === new URL('app.js', scope).pathname && url.searchParams.has('v') && url.searchParams.get('v') !== VERSION) { ev.respondWith(fetch(req)); return; }
  ev.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html', { ignoreSearch: true }) : null);
    if (hit) return hit;
    const res = url.pathname.startsWith(assetPath) ? await releaseAsset(req) : await fetch(req);
    if (res.ok && res.status !== 206) await c.put(req, res.clone());
    return res;
  }));
});
