// The calculator's service worker: the whole app is kept on the device when the worker installs, so it opens and
// works with no connection from the very first time on.
//
// VERSION and FILES are filled in by the build (the "precache" plugin in vite.config.ts): VERSION is a hash of every
// built file and of this file itself, FILES the list of them (scripts, styles, fonts, icons, manifest, and the app's base address, usually "/", for the
// page itself). A new build
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
// Where the app lives: the folder sw.js is served from ("/", or "/calculator/" for the copy on GitHub Pages). The page
// itself is kept under this address.
const BASE = new URL("./", location.href).pathname;

self.addEventListener("install", (e) => {
  if (DEV) { self.skipWaiting(); return; }
  e.waitUntil(precache());
});

/** Keeps every file of this version, a few at a time, telling the app's open windows how far it is ({ calcInstall: share
 *  0-1 }, for the progress bar in Settings → App & updates). All or nothing, as cache.addAll was: a file that can't be
 *  had fails the install and drops what was kept, so the next check starts again. */
async function precache() {
  // a cache by this name can only exist already if an earlier install of this same version was cut off; it is never
  // dropped on failure then, in case it is one the active worker serves from
  const fresh = !(await caches.has(CACHE));
  const c = await caches.open(CACHE);
  const todo = [...FILES];
  let done = 0, failed = false;
  // after a failure nothing more is told: the page has already given up on this worker, and a late share would show
  // "Downloading" again
  const tell = async () => {
    if (failed) return;
    const ws = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (failed) return;
    for (const w of ws) w.postMessage({ calcInstall: done / FILES.length });
  };
  const worker = async () => {
    // the first failure stops every downloader from taking another file
    for (let f = failed ? undefined : todo.shift(); f !== undefined; f = failed ? undefined : todo.shift()) {
      try {
        // "reload": straight from the server, never an older copy from the browser's own cache
        const r = await fetch(new Request(f, { cache: "reload" }));
        if (!r.ok) throw new Error("not kept: " + f);
        if (failed) return;
        await c.put(f, r);
      } catch (err) { failed = true; throw err; }
      done++;
      void tell();
    }
  };
  try { await Promise.all(Array.from({ length: 6 }, worker)); } catch (err) {
    failed = true;
    if (fresh) await caches.delete(CACHE);
    throw err;
  }
}

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
  // every address inside the app (a path without a file extension below BASE: /, /settings, /calculator/converter, ...)
  // is the same page; anything else (a font, an icon, /fonts/x.txt) is only answered with itself
  const route = r.mode === "navigate" && u.pathname.startsWith(BASE) && !/\.[^/]*$/.test(u.pathname);
  const key = route ? BASE : u.pathname;
  if (!FILES.includes(key)) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(key)).then((m) => m ?? fetch(r)));
});
