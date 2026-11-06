// The calculator's service worker (trimmed from Motus's): makes the web app installable and lets it open without a
// connection. The page: the network first, the last copy when offline. Built files (hashed names, never change): from
// the cache. In development nothing is cached at all.
const CACHE = "calc-v1";
const DEV = (p) => p.startsWith("/@") || p.startsWith("/src/") || p.startsWith("/node_modules/") || p.includes("?t=") || p.includes("?v=");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || DEV(u.pathname + u.search)) return;
  if (r.mode === "navigate") { e.respondWith(page(e)); return; }
  if (keep(u.pathname)) {
    e.respondWith(caches.match(r).then((m) => m ?? fetch(r).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then((cc) => cc.put(r, c)); }
      return res;
    })));
  }
});

const keep = (p) => p.startsWith("/assets/") || p.startsWith("/fonts/") || /\.(png|svg|woff2?|webmanifest)$/.test(p);
const PAGE_WAIT = 3000;

// The page: the network when it answers, the last copy otherwise. A network that never answers would hang the open,
// so after a few seconds the last copy opens (the late answer still refreshes it).
async function page(e) {
  const copy = await caches.match("/");
  let saving = Promise.resolve();
  const net = fetch(e.request).then((res) => {
    if (res.ok) { saving = keepPage(res.clone()); return res; }
    if (copy) throw new Error(String(res.status));
    return res;
  });
  e.waitUntil(net.then(() => saving).catch(() => {}));
  if (!copy) return net;
  return Promise.race([net, new Promise((ok) => setTimeout(() => ok(copy), PAGE_WAIT))]).catch(() => copy);
}

// The development server's page loads its code straight from the sources: never kept.
async function keepPage(res) {
  const html = await res.clone().text();
  if (html.includes("/@vite/client")) return;
  await (await caches.open(CACHE)).put("/", res);
}

// The page lists the files it loaded (some before this worker was looking after it, on the very first visit), so
// the app opens offline from the first time on.
self.addEventListener("message", (e) => {
  if (!Array.isArray(e.data?.keep)) return;
  e.waitUntil((async () => {
    const cc = await caches.open(CACHE);
    for (const p of e.data.keep) {
      if (typeof p !== "string") continue;
      let u;
      try { u = new URL(p, location.origin); } catch { continue; }
      if (u.origin !== location.origin || DEV(u.pathname + u.search)) continue;
      const isPage = u.pathname === "/" && !u.search;
      if ((!isPage && !keep(u.pathname)) || (await cc.match(u.href))) continue;
      try {
        const res = await fetch(u.href, { method: "GET" });
        if (res.ok) await (isPage ? keepPage(res) : cc.put(u.href, res));
      } catch { /* next time */ }
    }
  })());
});
