// In-app updates for the desktop and Android apps (task C-27, after Motus's updater). The web app / PWA updates itself
// through its service worker (core/update.ts) and has none of this.
// The check is one request to GitHub's public API (releases/latest; the Android app also reads the release's
// android-latest.json): no account, no identifiers, nothing about the person. It is made by the app itself (the desktop
// app's main process, the Android plugin), never by the page, so the page's own rules stay "the ECB only".
// Automatic checks (on by default, as in Motus): a few seconds after the app opens and then every 6 hours while it is
// open, at most once per 6 hours across restarts; "Check now" any time. Nothing is downloaded or installed without a tap.
import { reactive } from "vue";
import { readJson, writeJson } from "./prefs";
import { newer, readRelease, checkAndroidManifest, RELEASES_API, type AndroidManifest } from "./releases";

/** What the desktop app's preload script exposes (apps/desktop/src/preload.ts). */
interface DesktopBridge {
  version(): Promise<string>;
  /** "install": AppImage or Windows installer, electron-updater replaces the app; "link": deb/rpm, the release page. */
  mode(): Promise<"install" | "link">;
  latest(): Promise<unknown>;
  download(version: string): Promise<void>;
  onProgress(cb: (share: number) => void): void;
  install(): Promise<void>;
}
type Plugin = { [m: string]: ((a?: unknown) => Promise<unknown>) | undefined } & { addListener?: (ev: string, cb: (e: never) => void) => Promise<{ remove(): void }> | { remove(): void } };
const g = globalThis as { calcUpdate?: DesktopBridge; Capacitor?: { getPlatform?: () => string; Plugins?: Record<string, Plugin> } };
const desktop = () => g.calcUpdate;
const android = () => (g.Capacitor?.getPlatform?.() === "android" ? g.Capacitor.Plugins?.CalcUpdater : undefined);
/** Whether this copy is an installed app that updates itself here (else the web app, which needs nothing). */
export const appUpdates = () => !!(desktop() || android());

interface Prefs { auto: boolean; lastCheck: number }
const KEY = "calcUpdates";
const saved = readJson<Partial<Prefs>>(KEY, {});

export const upd = reactive({
  /** Check for updates automatically (Settings → Updates) */
  auto: saved.auto !== false,
  lastCheck: typeof saved.lastCheck === "number" ? saved.lastCheck : 0,
  current: "",
  /** the newer version found, "" when up to date or not checked */
  latest: "",
  notes: "",
  page: "",
  mode: "install" as "install" | "link",
  checking: false,
  downloading: false,
  /** 0-1 while a download runs, null when unknown */
  progress: null as number | null,
  /** the newer version is downloaded and checked, ready to install */
  ready: false,
  status: "",
  error: "",
});
/** The message to show: the desktop app's IPC wraps errors as "Error invoking remote method 'x': Error: ...". */
const said = (e: unknown, fallback: string) => String((e as Error)?.message || "").replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, "") || fallback;
const save = () => writeJson(KEY, { auto: upd.auto, lastCheck: upd.lastCheck } satisfies Prefs);
let manifest: AndroidManifest | null = null;

async function androidGet(url: string): Promise<unknown> {
  const r = (await android()!.get!({ url })) as { status?: number; body?: string };
  if (r?.status === 404) throw new Error("No release yet");
  if (r?.status === 403 || r?.status === 429) throw new Error("GitHub is busy, try again later");
  if (!r || r.status !== 200 || typeof r.body !== "string") throw new Error("Could not reach GitHub");
  try { return JSON.parse(r.body); } catch { throw new Error("GitHub's answer is unreadable"); }
}

let started: Promise<void> | null = null;
function start() {
  return (started ??= (async () => {
    try {
      const d = desktop(), a = android();
      if (d) { upd.current = await d.version(); upd.mode = await d.mode(); }
      else if (a) {
        upd.current = String(((await a.version!()) as { version?: string })?.version ?? "");
        // a download that finished before the app was closed is still ready (the plugin checked it again)
        const s = (await a.staged!().catch(() => null)) as { version?: string } | null;
        if (s?.version && newer(s.version, upd.current)) { upd.latest = s.version; upd.ready = true; upd.status = `Version ${s.version} is ready to install`; }
      }
    } catch { /* the version stays unknown: no update is offered */ }
  })());
}

/** Asks GitHub for the latest release. Never throws: problems end up in `upd.error`. */
export async function checkNow(): Promise<void> {
  if (!appUpdates() || upd.checking || upd.downloading) return;
  upd.checking = true; upd.error = "";
  try {
    await start();
    const d = desktop();
    const raw = d ? await d.latest() : await androidGet(RELEASES_API);
    const rel = readRelease(raw);
    if (typeof rel === "string") throw new Error(rel);
    upd.lastCheck = Date.now(); save();
    if (!newer(rel.version, upd.current)) {
      upd.latest = ""; upd.ready = false; upd.status = upd.current ? `Version ${upd.current} is the latest` : ""; return;
    }
    if (!d) {
      if (!rel.manifestUrl) throw new Error("The release has no Android update");
      const m = checkAndroidManifest(await androidGet(rel.manifestUrl), rel.version);
      if (typeof m === "string") throw new Error(m);
      manifest = m;
    }
    if (upd.latest !== rel.version) upd.ready = false;
    upd.latest = rel.version; upd.notes = rel.notes; upd.page = rel.page;
    upd.status = upd.ready ? `Version ${rel.version} is ready to install` : `Version ${rel.version} is available`;
  } catch (e) {
    upd.error = said(e, "Could not reach GitHub");
  } finally { upd.checking = false; }
}

/** Downloads the newer version and checks it (desktop: electron-updater's SHA-512 from latest.yml; Android: size,
 *  SHA-256 from android-latest.json and the same signing certificate as the installed app). */
export async function download(): Promise<void> {
  if (!upd.latest || upd.downloading || upd.ready) return;
  upd.downloading = true; upd.progress = null; upd.error = ""; upd.status = "Downloading";
  const at = (p: number) => { upd.progress = p >= 0 ? Math.min(1, p) : null; upd.status = p >= 0 ? `Downloading ${Math.round(p * 100)}%` : "Downloading"; };
  let h: { remove(): void } | null = null;
  try {
    const d = desktop(), a = android();
    if (d) { d.onProgress(at); await d.download(upd.latest); }
    else if (a) {
      if (!manifest || manifest.version !== upd.latest) throw new Error("Check for updates again first");
      h = (await a.addListener?.("progress", (({ loaded, total }: { loaded: number; total: number }) => at(total > 0 ? loaded / total : -1)) as (e: never) => void)) ?? null;
      await a.download!({ ...manifest });
    }
    upd.ready = true; upd.status = `Version ${upd.latest} is ready to install`;
  } catch (e) {
    upd.error = said(e, "The download didn't finish"); upd.status = "";
  } finally { h?.remove(); upd.downloading = false; upd.progress = null; }
}

/** Desktop: closes the app, installs and starts the new version. Android: opens Android's installer, which asks first. */
export async function install(): Promise<void> {
  if (!upd.ready) return;
  upd.error = "";
  try { const d = desktop(); if (d) await d.install(); else await android()?.install!(); }
  catch (e) { upd.error = said(e, "Could not start the installer"); }
}

export function setAuto(on: boolean) { upd.auto = on; save(); if (on) void tick(); }

const EVERY = 6 * 3600_000;
const tick = async () => { if (upd.auto && Date.now() - upd.lastCheck >= EVERY) await checkNow(); };
let running = false;
/** Called once by App.vue: in the apps, the automatic checks; elsewhere nothing. Starts after the first paint. */
export function startAppUpdates() {
  if (running || !appUpdates()) return;
  running = true;
  void start();
  setTimeout(() => void tick(), 8000);
  setInterval(() => void tick(), 15 * 60_000);
  addEventListener("online", () => void tick());
}
