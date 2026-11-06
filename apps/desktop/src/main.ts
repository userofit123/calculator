// The Calculator desktop app: the built web app (apps/web/dist) shown in a window, straight from files inside the app.
// No server, no account, nothing loaded from the internet: the pages come through the app:// scheme below, and the only
// request that may leave the computer is the optional ECB currency-rate refresh made by the page itself.
// Updates are left out for now; electron-updater can be added later next to whenReady (see the note there).
import { app, BrowserWindow, Menu, ipcMain, protocol, session, shell, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SCHEME = "app";
const HOST = "calculator";
const ORIGIN = `${SCHEME}://${HOST}`;
// the one outside address the page may reach (packages/core/src/currency.ts, ECB_RATES_URL)
const ECB = "https://data-api.ecb.europa.eu";
const WEB = app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(__dirname, "../../web/dist");
const USER = app.getPath("userData");
const STATE = path.join(USER, "window.json");
// the background of the last look, so the window opens in its colour instead of white (written when the look changes)
const BOOT = path.join(USER, "boot.json");
const DEFAULT_BG = "#17100d"; // the same first-open colour as index.html

// a standard, secure scheme: its own origin (localStorage keeps the look, history and rates), absolute paths like
// /assets/x.js resolve, and fetch/crypto behave as on https
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);
// no spell-check dictionaries downloaded from Google, no background network services
app.commandLine.appendSwitch("disable-features", "SpellcheckService,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,OptimizationHints");

const readJson = <T>(f: string, d: T): T => { try { return JSON.parse(fs.readFileSync(f, "utf8")) as T; } catch { return d; } };
const writeJson = (f: string, v: unknown) => { try { fs.mkdirSync(USER, { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); } catch { /* next time it opens in the default size or colour */ } };
const isColour = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{3,8}$/i.test(s);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
};

// The page's rules: only its own files, plus the ECB rates. index.html's inline boot script (paints the saved look before
// anything loads) is allowed by its hash, worked out from the file itself so a change to it never needs a change here.
let csp = "";
function policy(html: string) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]!).digest("base64")}'`);
  return [
    "default-src 'none'", `script-src 'self' ${hashes.join(" ")}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    `connect-src ${ECB}`, "manifest-src 'self'", "worker-src 'none'", "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join("; ");
}

async function serve(req: Request): Promise<Response> {
  const u = new URL(req.url);
  if (u.host !== HOST) return new Response(null, { status: 404 });
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  let file = path.join(WEB, path.normalize(rel));
  if (!file.startsWith(WEB + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // a file that should be there but isn't (a missing chunk) is a 404; any other address is one of the app's pages
    if (path.extname(rel)) return new Response(null, { status: 404 });
    rel = "index.html"; file = path.join(WEB, rel);
  }
  const body = await fs.promises.readFile(file);
  const headers: Record<string, string> = { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "x-content-type-options": "nosniff" };
  if (file.endsWith(".html")) { if (!csp) csp = policy(body.toString("utf8")); headers["content-security-policy"] = csp; }
  return new Response(body, { headers });
}

let win: BrowserWindow | null = null;

interface WinState { x?: number; y?: number; width: number; height: number; maximized?: boolean }
function savedState(): WinState {
  const s = readJson<WinState>(STATE, { width: 400, height: 640 });
  const w = Math.max(320, Math.round(+s.width || 400)), h = Math.max(480, Math.round(+s.height || 640));
  // the saved place only if it is still on a screen (a monitor may have been unplugged since)
  if (typeof s.x === "number" && typeof s.y === "number") {
    const on = screen.getAllDisplays().some((d) => { const a = d.workArea; return s.x! + 80 > a.x && s.y! + 40 > a.y && s.x! < a.x + a.width - 80 && s.y! < a.y + a.height - 40; });
    if (on) return { x: s.x, y: s.y, width: w, height: h, maximized: !!s.maximized };
  }
  return { width: w, height: h, maximized: !!s.maximized };
}

function createWindow() {
  const st = savedState();
  const boot = readJson<{ bg?: string }>(BOOT, {});
  const w = new BrowserWindow({
    ...st, minWidth: 320, minHeight: 480, show: false, autoHideMenuBar: true, title: "Calculator",
    backgroundColor: isColour(boot.bg) ? boot.bg : DEFAULT_BG,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, spellcheck: false, devTools: !app.isPackaged },
  });
  if (st.maximized) w.maximize();
  w.once("ready-to-show", () => w.show());

  // remember the size and place (not while maximized: then the size to come back to is kept)
  let t: NodeJS.Timeout | undefined;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (w.isDestroyed()) return; const max = w.isMaximized(); writeJson(STATE, { ...(max ? readJson(STATE, {}) : w.getNormalBounds()), maximized: max }); }, 400); };
  w.on("resize", remember); w.on("move", remember); w.on("maximize", remember); w.on("unmaximize", remember);
  w.on("close", () => { clearTimeout(t); const max = w.isMaximized(); writeJson(STATE, { ...(max ? readJson(STATE, {}) : w.getNormalBounds()), maximized: max }); });

  // links leave the app for the system browser (https only); the window itself never goes anywhere but the app
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  w.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(ORIGIN + "/")) { e.preventDefault(); if (/^https:\/\//i.test(url)) void shell.openExternal(url); } });
  w.webContents.on("will-redirect", (e, url) => { if (!url.startsWith(ORIGIN + "/")) e.preventDefault(); });
  w.webContents.on("will-attach-webview", (e) => e.preventDefault());
  w.on("closed", () => { if (win === w) win = null; });
  void w.loadURL(ORIGIN + "/");
  return w;
}

// the look's background, sent by the page whenever it changes (preload.ts, calcApp.setBars): the window's own colour
// follows it now (nothing white shows while resizing) and the next open starts in it
let lastBg = "";
ipcMain.on("look:bg", (e, bg: unknown) => {
  if (!isColour(bg) || bg === lastBg) return;
  lastBg = bg;
  BrowserWindow.fromWebContents(e.sender)?.setBackgroundColor(bg);
  if (readJson<{ bg?: string }>(BOOT, {}).bg !== bg) writeJson(BOOT, { bg });
});

app.setAppUserModelId("io.github.userofit123.calculator");
// one window: opening the app again brings the open one to the front
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (!win) { win = createWindow(); return; } if (win.isMinimized()) win.restore(); win.show(); win.focus(); });
  app.whenReady().then(() => {
    // no menu bar, like Motus; copy, paste and cut still work (Chromium handles them on Linux and Windows) and the
    // page handles every other key itself
    Menu.setApplicationMenu(null);
    const s = session.defaultSession;
    s.protocol.handle(SCHEME, serve);
    // nothing leaves the computer except the ECB rates the page asks for (defence behind the page's own rules)
    s.webRequest.onBeforeRequest((d, cb) => {
      const ok = d.url.startsWith(ORIGIN + "/") || d.url.startsWith(ECB + "/") || /^(data|blob|devtools|chrome-extension):/.test(d.url);
      cb({ cancel: !ok });
    });
    // no camera, microphone, location, notifications…; only writing to the clipboard (the Copy buttons)
    const allowed = new Set(["clipboard-sanitized-write"]);
    s.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
    s.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
    // In-app updates (task C-27) belong here: electron-updater's autoUpdater, started only when the person asks.
    win = createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  // no other page, window or web view can be made by anything inside the app
  app.on("web-contents-created", (_e, wc) => { wc.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) void shell.openExternal(url); return { action: "deny" }; }); });
}
