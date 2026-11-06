// Bundles the main process and the preload script, and copies in the window icon.
import { build } from "esbuild";
import fs from "node:fs";
const common = { bundle: true, platform: "node", target: "node20", format: "cjs", sourcemap: false, logLevel: "info", external: ["electron"] };
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.cjs" });
await build({ ...common, entryPoints: ["src/preload.ts"], outfile: "dist/preload.cjs" });
// the window's own icon (the taskbar and alt-tab on Linux): 128 px, because Chromium's X11 window drops a bigger one
// (_NET_WM_ICON stays empty at 256 or 512); the menu entry's icon comes from build-res/icons (make-icons.py)
fs.copyFileSync("build-res/icons/128x128.png", "dist/icon.png");
if (!fs.existsSync("../web/dist/index.html")) console.warn("apps/web/dist is missing: run `pnpm run web` first");
