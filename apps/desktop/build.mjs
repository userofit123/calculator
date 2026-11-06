// Bundles the main process and the preload script; the window icon comes from the web app's icons.
import { build } from "esbuild";
import fs from "node:fs";
const common = { bundle: true, platform: "node", target: "node20", format: "cjs", sourcemap: false, logLevel: "info", external: ["electron"] };
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.cjs" });
await build({ ...common, entryPoints: ["src/preload.ts"], outfile: "dist/preload.cjs" });
fs.copyFileSync("../web/public/icon-512.png", "dist/icon.png");
if (!fs.existsSync("../web/dist/index.html")) console.warn("apps/web/dist is missing: run `pnpm run web` first");
