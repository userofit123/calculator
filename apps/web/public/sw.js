// The calculator's service worker: the whole app is kept on the device when the worker installs, so it opens and
// works with no connection from the very first time on.
//
// VERSION and FILES are filled in by the build (the "precache" plugin in vite.config.ts): VERSION is a hash of every
// built file, FILES the list of them (index.html, scripts, styles, fonts, icons, manifest). A new build changes VERSION,
// so the browser installs the new worker, which keeps the new files in a new cache and drops the old one; that is how
// the files without a hash in their name (index.html, the manifest, the icons) are updated.
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
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
  // every address inside the app is the same page
  const key = r.mode === "navigate" ? "/index.html" : u.pathname;
  if (!FILES.includes(key)) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(key)).then((m) => m ?? fetch(r)));
});
