import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

// In Docker the page is opened through a proxy: Caddy at https://calculator.local, or Tailscale at
// https://<machine>.ts.net from a phone. Hot reload then connects back to whatever address and port the page came
// from (VITE_HMR_HOST is set in docker-compose.dev.yml).
const hmrHost = process.env.VITE_HMR_HOST;
const version = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }).version;

// Fills in public/sw.js after a build: the list of every built file (so the worker keeps the whole app when it installs)
// and a version made from their contents (so every build that changes anything gets a new cache; the old one is
// dropped once no open page uses it any more). The development server serves sw.js as it is, which the worker takes as "cache nothing".
function precache(): Plugin {
  let outDir = "";
  return {
    name: "calc-precache",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const all = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(join(d, e.name)) : [join(d, e.name)]));
      const files = all(outDir).map((f) => "/" + relative(outDir, f).split(sep).join("/")).filter((f) => f !== "/sw.js").sort();
      const h = createHash("sha256");
      for (const f of files) h.update(f).update(readFileSync(join(outDir, f)));
      const sw = join(outDir, "sw.js"), src = readFileSync(sw, "utf8");
      if (!src.includes("__CALC_VERSION__") || !src.includes("/* __CALC_FILES__ */ []")) throw new Error("sw.js: the build's placeholders are missing");
      // the page is kept as "/" (what the app's addresses are answered with), not "/index.html": a host that redirects
      // /index.html to / would otherwise leave the worker holding a redirect instead of the page
      const keep = files.map((f) => (f === "/index.html" ? "/" : f));
      writeFileSync(sw, src.replace("__CALC_VERSION__", h.digest("hex").slice(0, 16)).replace("/* __CALC_FILES__ */ []", JSON.stringify(keep)));
    },
  };
}

export default defineConfig({
  plugins: [vue(), precache()],
  define: { "import.meta.env.VITE_VERSION": JSON.stringify(version) },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["calculator.local", "localhost", ".ts.net"],
    // Polling notices edits that replace the file (editors, sed -i), which file events in a container can miss.
    watch: process.env.WATCH_POLL ? { usePolling: true, interval: 300 } : undefined,
    hmr: hmrHost ? { protocol: "wss" } : undefined,
  },
});
