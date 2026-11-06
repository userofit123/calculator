// The calculator's service worker: the whole app is kept on the device when the worker installs, so it opens and
// works with no connection from the very first time on.
//
// VERSION and FILES are filled in by the build (the "precache" plugin in vite.config.ts): VERSION is a hash of every
// built file, FILES the list of them (scripts, styles, fonts, icons, manifest, and "/" for the page itself). A new build
// changes VERSION, so the browser installs the new worker, which keeps the new files in a new cache.
//
// An update never breaks a page that is already open: the new worker waits (no skipWaiting on install) while any page
// still runs the old version, so the old worker and its cache keep serving that page's files (pages it hasn't opened
// yet, such as Settings, load later from the old cache, also offline). The new version takes over on the next open,
// once no old page is left, and only then is the old cache dropped. A page may ask the waiting worker to take over
// early ("skip"), which it does only when that page is the app's only open window; the page then reloads itself.
const VERSION = "__CALC_VERSION__";
const FILES = /* __CALC_FILES__ */ [];
const PREFIX = "calc-";
const CACHE = PREFIX + VERSION;
// Not filled in: this is the development server's copy. Nothing is cached there; a worker left from a built copy on the
// same address removes itself and its caches.
const DEV = VERSION.startsWith("__");

self.addEventListener("install", (e) => {
  if (DEV) { self.skipWaiting(); return; }
  // "reload": straight from the server, never an older copy from the browser's own cache
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

self.addEventListener("message", (e) => {
  if (e.data !== "skip") return;
  // only with no other window open, so no other page can be left needing the old cache
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((w) => { if (w.length <= 1) return self.skipWaiting(); }));
});

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && (DEV || k !== CACHE)) await caches.delete(k);
  if (DEV) { await self.registration.unregister(); return; }
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  if (DEV) return;
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // every address inside the app (a path without a file extension: /, /settings, ...) is the same page; anything else
  // (a font, an icon, /fonts/x.txt) is only answered with itself
  const route = r.mode === "navigate" && !/\.[^/]*$/.test(u.pathname);
  const key = route ? "/" : u.pathname;
  if (!FILES.includes(key)) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(key)).then((m) => m ?? fetch(r)));
});
