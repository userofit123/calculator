// Copies the built web app (apps/web/dist) into www/ for the Android app: everything ships inside the APK, nothing is
// loaded from the internet. The service worker is left out: the app carries its own files (main.ts doesn't start it here).
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const dist = path.join(root, "apps/web/dist");
if (!fs.existsSync(path.join(dist, "index.html"))) { console.error("Build the web app first: pnpm --filter @calc/web exec vite build"); process.exit(1); }
fs.rmSync("www", { recursive: true, force: true });
fs.cpSync(dist, "www", { recursive: true });
fs.rmSync("www/sw.js", { force: true });
console.log("www ready");
