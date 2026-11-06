// The Calculator desktop app: the built web app (apps/web/dist) shown in a window, straight from files inside the app.
// No server, no account, nothing loaded from the internet: the pages come through the app:// scheme below, and the only
// request that may leave the computer is the optional ECB currency-rate refresh made by the page itself.
// The optional update check (Settings → Updates) is made here in the main process, in its own sessions, never by the page.
import { app, BrowserWindow, Menu, ipcMain, protocol, session, shell, screen } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SCHEME = "app";
const HOST = "calculator";
const ORIGIN = `${SCHEME}://${HOST}`;
// the one outside address the page may reach (packages/core/src/currency.ts, ECB_RATES_URL)
const ECB = "https://data-api.ecb.europa.eu";
const WEB = app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(__dirname, "../../web/dist");
// its own data folder, named like the app id, so it can never share settings with another calculator app
app.setPath("userData", path.join(app.getPath("appData"), "io.github.userofit123.calculator"));
const USER = app.getPath("userData");
const STATE = path.join(USER, "window.json");
// the background of the last look, so the window opens in its colour instead of white (written when the look changes)
const BOOT = path.join(USER, "boot.json");
// the only outside pages a link may open in the system browser
const LINKS = ["https://github.com/userofit123/calculator", "https://www.ecb.europa.eu/", "https://data.ecb.europa.eu/"];
const openLink = (url: string) => {
  try { const u = new URL(url); if (u.protocol === "https:" && LINKS.some((l) => { const a = new URL(l); return u.host === a.host && (a.pathname === "/" || u.pathname === a.pathname || u.pathname.startsWith(a.pathname + "/")); })) void shell.openExternal(u.href); } catch { /* not a link */ }
};
const DEFAULT_BG = "#17100d"; // the same first-open colour as index.html

// a standard, secure scheme: its own origin (localStorage keeps the look, history and rates), absolute paths like
// /assets/x.js resolve, and fetch/crypto behave as on https
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);
// no spell-check dictionaries downloaded from Google, no background network services
app.commandLine.appendSwitch("disable-features", "SpellcheckService,MediaRouter,DialMediaRouteProvider,AutofillServerCommunication,OptimizationHints");

const readJson = <T>(f: string, d: T): T => { try { return JSON.parse(fs.readFileSync(f, "utf8")) as T; } catch { return d; } };
const writeJson = (f: string, v: unknown) => { try { fs.mkdirSync(USER, { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); } catch { /* next time it opens in the default size or colour */ } };
const isColour = (s: unknown): s is string => typeof s === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

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
  let rel: string;
  try { rel = decodeURIComponent(u.pathname).replace(/^\/+/, ""); } catch { return new Response(null, { status: 404 }); }
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
  // maximize only when ready: on a hidden window it would show it early
  w.once("ready-to-show", () => { if (st.maximized) w.maximize(); w.show(); });

  // remember the size and place (not while maximized: then the size to come back to is kept)
  let t: NodeJS.Timeout | undefined;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (w.isDestroyed()) return; const max = w.isMaximized(); writeJson(STATE, { ...(max ? readJson(STATE, {}) : w.getNormalBounds()), maximized: max }); }, 400); };
  w.on("resize", remember); w.on("move", remember); w.on("maximize", remember); w.on("unmaximize", remember);
  w.on("close", () => { clearTimeout(t); const max = w.isMaximized(); writeJson(STATE, { ...(max ? readJson(STATE, {}) : w.getNormalBounds()), maximized: max }); });

  // links leave the app for the system browser (https only); the window itself never goes anywhere but the app
  w.webContents.setWindowOpenHandler(({ url }) => { openLink(url); return { action: "deny" }; });
  w.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(ORIGIN + "/")) { e.preventDefault(); openLink(url); } });
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

// ----- updates from GitHub Releases (task C-27, after Motus) -----
// The page asks (Settings → Updates: automatic checks on by default, Check now); this process makes the requests, in
// sessions of their own that may reach GitHub and nothing else, so the page's own rules stay "the ECB only". The check is
// one GET of the public releases/latest API with no cookies and no identifiers. Downloading and installing are always
// the person's tap: electron-updater fetches latest.yml / latest-linux.yml and the installer from the release, checks
// its SHA-512 against latest.yml, and installs only on "Restart and install". The AppImage and the Windows installer
// update themselves; the .deb and .rpm are the system's packages, so there the page links to the release page instead.
const UPDATE_HOSTS = new Set(["api.github.com", "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]);
const RELEASES_API = "https://api.github.com/repos/userofit123/calculator/releases/latest";
/** Only https to GitHub's hosts, and nothing in these sessions is kept on disk or sent back (no cookies, no cache). */
function githubOnly(s: Electron.Session) {
  s.webRequest.onBeforeRequest((d, cb) => { let ok = false; try { const u = new URL(d.url); ok = u.protocol === "https:" && UPDATE_HOSTS.has(u.hostname); } catch { /* no */ } cb({ cancel: !ok }); });
  s.webRequest.onBeforeSendHeaders((d, cb) => { const h = { ...d.requestHeaders }; delete h.Cookie; delete h.Referer; cb({ requestHeaders: h }); });
  s.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
}
// "install": electron-updater can replace this copy (the AppImage, the Windows installer); "link": a .deb / .rpm (or
// running from the source), which the person updates from the release page
const updateMode = (): "install" | "link" => (app.isPackaged && (process.platform === "win32" || (process.platform === "linux" && !!process.env.APPIMAGE)) ? "install" : "link");
let checkSession: Electron.Session | null = null;
let downloaded = "";
function fromApp(e: Electron.IpcMainInvokeEvent) { return !!win && e.sender === win.webContents && e.senderFrame?.url.startsWith(ORIGIN + "/"); }
function startUpdates() {
  // in memory only (no "persist:"): nothing of the check is written to disk
  checkSession = session.fromPartition("calc-update-check", { cache: false });
  githubOnly(checkSession);
  // electron-updater's own session (electronHttpExecutor: partition "electron-updater")
  githubOnly(session.fromPartition("electron-updater", { cache: false }));
  ipcMain.handle("update:version", (e) => (fromApp(e) ? app.getVersion() : ""));
  ipcMain.handle("update:mode", (e) => (fromApp(e) ? updateMode() : "link"));
  // the release's tag, notes, page and draft flags, read and judged by the page (apps/web/src/core/releases.ts)
  ipcMain.handle("update:latest", async (e) => {
    if (!fromApp(e)) throw new Error("Not allowed");
    const r = await checkSession!.fetch(RELEASES_API, { headers: { accept: "application/vnd.github+json", "user-agent": "Calculator" }, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(20_000) })
      .catch(() => { throw new Error("Could not reach GitHub"); });
    if (r.status === 404) throw new Error("No release yet");
    if (r.status === 403 || r.status === 429) throw new Error("GitHub is busy, try again later");
    if (!r.ok) throw new Error("Could not reach GitHub");
    const j = (await r.json()) as Record<string, unknown>;
    const assets = Array.isArray(j.assets) ? (j.assets as Record<string, unknown>[]).map((a) => ({ name: a.name, browser_download_url: a.browser_download_url })) : [];
    return { tag_name: j.tag_name, body: j.body, html_url: j.html_url, draft: j.draft, prerelease: j.prerelease, assets };
  });
  ipcMain.handle("update:download", async (e, want: unknown) => {
    if (!fromApp(e) || updateMode() !== "install" || typeof want !== "string") throw new Error("Not allowed");
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = null;
    autoUpdater.removeAllListeners("download-progress");
    autoUpdater.on("download-progress", (p) => {
      win?.setProgressBar(p.total > 0 ? p.percent / 100 : -1);
      win?.webContents.send("update:progress", p.total > 0 ? p.percent / 100 : -1);
    });
    try {
      const r = await autoUpdater.checkForUpdates().catch(() => null);
      const v = r?.updateInfo?.version;
      // the version the page showed (and its notes) must be the one about to be downloaded
      if (!r || !v) throw new Error("Could not reach GitHub");
      if (v !== want) throw new Error("A different version was found: check again");
      // checks the file's SHA-512 against latest.yml; a damaged download fails here
      await autoUpdater.downloadUpdate();
      downloaded = v;
    } catch (err) {
      throw new Error((err as Error)?.message?.startsWith("A different") ? (err as Error).message : "The download didn't finish or didn't match: try again");
    } finally { win?.setProgressBar(-1); }
  });
  ipcMain.handle("update:install", (e) => {
    if (!fromApp(e) || !downloaded) throw new Error("Nothing downloaded");
    // closes the app, installs (the Windows installer silently, the AppImage replaced in place) and starts it again
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });
}

app.setAppUserModelId("io.github.userofit123.calculator");
// one window: opening the app again brings the open one to the front
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (!app.isReady()) return; if (!win) { win = createWindow(); return; } if (win.isMinimized()) win.restore(); win.show(); win.focus(); });
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
    startUpdates();
    win = createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  // no other page, window or web view can be made by anything inside the app
  app.on("web-contents-created", (_e, wc) => { wc.setWindowOpenHandler(({ url }) => { openLink(url); return { action: "deny" }; }); });
}
