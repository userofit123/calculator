// In-app updates for the desktop and Android apps (task C-27, after Motus's updater; C-52 added Motus's App & updates
// settings: how often to check, automatic downloads, Only on Wi-Fi, the progress bar and the Android notification). The
// web app / PWA updates itself through its service worker (core/update.ts), which uses only How often (`upd.every`) and
// the last check from here.
// The check is one request to GitHub's public API (releases/latest; the Android app also reads the release's
// android-latest.json): no account, no identifiers, nothing about the person. It is made by the app itself (the desktop
// app's main process, the Android plugin), never by the page, so the page's own rules stay "the ECB only".
// Automatic checks (on by default, as in Motus): a few seconds after the app opens and then as often as Settings says
// (every time the app opens, every 6 hours (the default, Motus's), once a day or once a week), counted across restarts;
// after a failed check (offline, GitHub busy) another automatic try only after RETRY_GAP, however often the network
// comes back; "Check now" any time. "No release yet" and "this release has no Android update" are answers, not
// failures: they count as a check. "Download updates automatically" (on by default, as in Motus) then fetches what a
// check found in the background (with "Only on Wi-Fi", not on mobile data) and leaves it ready: installing is always the
// person's tap (Android's installer asks too, and so does the system's password prompt for the desktop .deb / .rpm; the
// AppImage and the Windows app also install when they are closed). Nothing here ever pops
// up or takes focus, so nobody is interrupted mid-typing (C-31).
import { reactive } from "vue";
import { readJson, writeJson } from "./prefs";
import { t } from "./i18n";
import { newer, readRelease, checkAndroidManifest, shareOf, progressText, RELEASES_API, type AndroidManifest } from "./releases";

/** What the desktop app's preload script exposes (apps/desktop/src/preload.ts). */
interface DesktopBridge {
  version(): Promise<string>;
  /** "install": AppImage, Windows installer, .deb or .rpm, electron-updater replaces the app; "link": a development
   *  copy (or macOS), the release page. */
  mode(): Promise<"install" | "link">;
  /** what kind of copy this is, for App & updates: "AppImage", "Windows", "mac", "deb", "rpm", "package" (another
   *  Linux copy) or "dev" */
  kind?(): Promise<string>;
  latest(): Promise<unknown>;
  /** onQuit: install the download when the app is closed (only when the person chose automatic downloads) */
  download(version: string, onQuit?: boolean): Promise<void>;
  onProgress(cb: (share: number) => void): void;
  installOnQuit?(on: boolean): Promise<void>;
  install(): Promise<void>;
}
type Plugin = { [m: string]: ((a?: unknown) => Promise<unknown>) | undefined } & { addListener?: (ev: string, cb: (e: never) => void) => Promise<{ remove(): void }> | { remove(): void } };
const g = globalThis as { calcUpdate?: DesktopBridge; Capacitor?: { getPlatform?: () => string; Plugins?: Record<string, Plugin> } };
const desktop = () => g.calcUpdate;
const android = () => (g.Capacitor?.getPlatform?.() === "android" ? g.Capacitor.Plugins?.CalcUpdater : undefined);
/** Whether this copy is an installed app that updates itself here (else the web app, which needs nothing). */
export const appUpdates = () => !!(desktop() || android());
export const onAndroid = () => !!android();

/** How often automatic checks look (Settings → App & updates → How often). */
export type Every = "open" | "6h" | "day" | "week";
export const EVERY_CHOICES: readonly Every[] = ["open", "6h", "day", "week"];
const HOUR = 3600_000;
/** The least time between two automatic checks; "open" looks once each time the app starts. */
export const GAP: Record<Every, number> = { open: 0, "6h": 6 * HOUR, day: 24 * HOUR, week: 7 * 24 * HOUR };
/** The default, Motus's: every 6 hours */
export const EVERY = GAP["6h"];

interface Prefs { auto: boolean; every: Every; autoDownload: boolean; wifiOnly: boolean; lastCheck: number }
const KEY = "calcUpdates";
const saved = readJson<Partial<Prefs>>(KEY, {});

export const upd = reactive({
  /** Check for updates automatically */
  auto: saved.auto !== false,
  every: (EVERY_CHOICES.includes(saved.every as Every) ? saved.every : "6h") as Every,
  /** Download updates automatically (Motus's default: on) */
  autoDownload: saved.autoDownload !== false,
  /** Only on Wi-Fi: an automatic download waits while the connection is metered (Android) */
  wifiOnly: saved.wifiOnly === true,
  lastCheck: typeof saved.lastCheck === "number" ? saved.lastCheck : 0,
  current: "",
  /** what kind of copy: "android", "AppImage", "Windows", "mac", "deb", "rpm", "package", "dev" ("" until known) */
  kind: "",
  /** Android's version code, shown as the build */
  build: "",
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
  /** Install was tapped and hasn't answered yet (a .deb / .rpm waits for the system's password prompt) */
  installing: false,
  /** Android: whether it can tell a metered connection (then Only on Wi-Fi shows) */
  canTellMetered: false,
  /** Android: may the app show the download's notification ("granted", "denied", "prompt"; "" elsewhere) */
  notify: "" as "" | "granted" | "denied" | "prompt",
  status: "",
  error: "",
});
/** The message to show: the desktop app's IPC wraps errors as "Error invoking remote method 'x': Error: ...". */
const said = (e: unknown, fallback: string) => String((e as Error)?.message || "").replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, "") || fallback;
const save = () => writeJson(KEY, { auto: upd.auto, every: upd.every, autoDownload: upd.autoDownload, wifiOnly: upd.wifiOnly, lastCheck: upd.lastCheck } satisfies Prefs);
/** A check that got an answer, also the web app's service-worker check (core/update.ts): for "Checked ..." and How often. */
export function noteCheck() { upd.lastCheck = Date.now(); save(); }
let manifest: AndroidManifest | null = null;

/** Answers that mean "nothing to update to" rather than "the check failed": the check counts as made. */
export const NO_RELEASE = "No release yet";
export const NO_ANDROID = "The release has no Android update";
export const nothingNew = (msg: string) => msg === NO_RELEASE || msg === NO_ANDROID;
/** After a failed check or download, no automatic try before this much time has passed (GitHub's rate limits). */
export const RETRY_GAP = 15 * 60_000;
/** Whether an automatic check is due: automatic checks on, not within RETRY_GAP of a failed one, and then "open": not
 *  yet in this run of the app; otherwise the chosen gap since the last check that got an answer. */
export function checkDue(s: { auto: boolean; every?: Every; lastCheck: number; lastFail: number; checkedThisRun?: boolean }, now: number): boolean {
  if (!s.auto || now - s.lastFail < RETRY_GAP) return false;
  const every = s.every ?? "6h";
  if (every === "open") return !s.checkedThisRun;
  return now - s.lastCheck >= GAP[every];
}
/** Whether to download what a check found without a tap: automatic checks and downloads on, a newer version found that
 *  this copy can install itself, nothing ready or running, not on a metered connection with Only on Wi-Fi, and not
 *  within RETRY_GAP of a failed download. `metered` null: the device can't tell, so it doesn't wait. */
export function autoDownloadDue(s: { auto: boolean; autoDownload: boolean; latest: string; mode: "install" | "link"; ready: boolean; downloading: boolean; wifiOnly: boolean; metered: boolean | null; lastFail: number }, now: number): boolean {
  return s.auto && s.autoDownload && !!s.latest && s.mode === "install" && !s.ready && !s.downloading
    && !(s.wifiOnly && s.metered === true) && now - s.lastFail >= RETRY_GAP;
}
/** When the last check failed, and the last automatic download (this run only; a restart may try again at once). */
let lastFail = 0, lastDlFail = 0, checkedThisRun = false;
/** Whether a check has got an answer in this run of the app (for tests). */
export const checkedThisRunNow = () => checkedThisRun;

async function androidGet(url: string): Promise<unknown> {
  const r = (await android()!.get!({ url })) as { status?: number; body?: string };
  if (r?.status === 404) throw new Error(NO_RELEASE);
  if (r?.status === 403 || r?.status === 429) throw new Error("GitHub is busy, try again later");
  if (!r || r.status !== 200 || typeof r.body !== "string") throw new Error("Could not reach GitHub");
  try { return JSON.parse(r.body); } catch { throw new Error("GitHub's answer is unreadable"); }
}
const isNotify = (s: unknown): s is "granted" | "denied" | "prompt" => s === "granted" || s === "denied" || s === "prompt";

let started: Promise<void> | null = null;
function start() {
  return (started ??= (async () => {
    try {
      const d = desktop(), a = android();
      if (d) { upd.current = await d.version(); upd.mode = await d.mode(); upd.kind = String((await d.kind?.().catch(() => "")) ?? ""); }
      else if (a) {
        const v = (await a.version!()) as { version?: string; install?: boolean; build?: number } | null;
        upd.current = String(v?.version ?? "");
        upd.kind = "android";
        upd.build = typeof v?.build === "number" && Number.isInteger(v.build) && v.build > 0 ? String(v.build) : "";
        // Android 5.1-6 can't install from the app (CalcUpdaterPlugin): the release page instead
        upd.mode = v?.install === false ? "link" : "install";
        upd.canTellMetered = true;
        await refreshNotify();
        // a download that finished before the app was closed is still ready (the plugin checked it again)
        const s = (await a.staged!().catch(() => null)) as { version?: string } | null;
        if (s?.version && newer(s.version, upd.current)) { upd.latest = s.version; upd.ready = true; upd.status = `Version ${s.version} is ready to install`; }
      }
    } catch { /* the version stays unknown: no update is offered */ }
  })());
}

/** Android: whether the download's notification may show (asked of the phone again at every look: it can change in
 *  the phone's settings). */
export async function refreshNotify(): Promise<void> {
  const a = android();
  if (!a?.notifyState) return;
  const r = (await a.notifyState().catch(() => null)) as { state?: unknown } | null;
  if (isNotify(r?.state)) upd.notify = r.state;
}
/** Android 13+: asks to show notifications (the download's progress and "Update ready - tap to install"). Only ever
 *  from the person's tap (Allow, turning on automatic downloads, Download), never by itself. */
export async function askNotify(): Promise<void> {
  const a = android();
  if (!a?.askNotify || upd.notify === "granted") return;
  const r = (await a.askNotify().catch(() => null)) as { state?: unknown } | null;
  if (isNotify(r?.state)) upd.notify = r.state;
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
    checkedThisRun = true; // only a check that got an answer counts for "every time the app opens"
    if (!newer(rel.version, upd.current)) {
      upd.latest = ""; upd.ready = false; upd.status = upd.current ? `Version ${upd.current} is the latest` : ""; return;
    }
    if (!d && upd.mode === "install") {
      if (!rel.manifestUrl) throw new Error(NO_ANDROID);
      const m = checkAndroidManifest(await androidGet(rel.manifestUrl), rel.version);
      if (typeof m === "string") throw new Error(m);
      manifest = m;
    }
    // a ready download of an older version gives way to the newer one (the next download replaces its file)
    if (upd.latest !== rel.version) upd.ready = false;
    upd.latest = rel.version; upd.notes = rel.notes; upd.page = rel.page;
    upd.status = upd.ready ? `Version ${rel.version} is ready to install`
      : !d && upd.mode === "link" ? `Version ${rel.version} is available: install the update from the release page` : `Version ${rel.version} is available`;
    lastFail = 0;
  } catch (e) {
    const msg = said(e, "Could not reach GitHub");
    if (nothingNew(msg)) {
      // GitHub answered: nothing (usable) to update to, so this is a made check, not one to retry soon
      upd.lastCheck = Date.now(); save(); lastFail = 0; checkedThisRun = true;
      upd.latest = ""; upd.ready = false; upd.status = msg;
    } else { upd.error = msg; lastFail = Date.now(); }
  } finally { upd.checking = false; }
}

/** The Android notification's words, in the language shown (the plugin falls back to English). */
const noticeTexts = (v: string) => ({
  channel: t("upd.nChannel"),
  downloading: t("upd.nDownloading", { v }),
  ready: t("upd.nReady"),
  readyText: t("upd.nReadyText", { v }),
  failed: t("upd.nFailed"),
  failedText: t("upd.nFailedText"),
});

/** Downloads the newer version and checks it (desktop: electron-updater's SHA-512 from latest.yml; Android: size,
 *  SHA-256 from android-latest.json and the same signing certificate as the installed app). `byHand`: the person
 *  tapped Download, so Android may ask once to show the download's notification. */
export async function download(byHand = false): Promise<void> {
  if (!upd.latest || upd.downloading || upd.ready) return;
  if (byHand && upd.notify === "prompt") await askNotify();
  upd.downloading = true; upd.progress = null; upd.error = ""; upd.status = progressText(null);
  // share < 0: the size is unknown (the bar then moves without a number)
  const at = (share: number, bytes?: number) => {
    upd.progress = typeof share === "number" && Number.isFinite(share) && share >= 0 ? Math.min(1, share) : null;
    upd.status = progressText(upd.progress, bytes);
  };
  let h: { remove(): void } | null = null;
  try {
    const d = desktop(), a = android();
    if (d) { d.onProgress((p) => at(p)); await d.download(upd.latest, upd.autoDownload); }
    else if (a) {
      if (!manifest || manifest.version !== upd.latest) throw new Error("Check for updates again first");
      h = (await a.addListener?.("progress", (({ loaded, total }: { loaded: number; total: number }) => at(shareOf(loaded, total) ?? -1, loaded)) as (e: never) => void)) ?? null;
      await a.download!({ ...manifest, texts: noticeTexts(manifest.version) });
    }
    upd.ready = true; upd.status = `Version ${upd.latest} is ready to install`; lastDlFail = 0;
  } catch (e) {
    upd.error = said(e, "The download didn't finish"); upd.status = ""; lastDlFail = Date.now();
  } finally { h?.remove(); upd.downloading = false; upd.progress = null; }
}

/** Desktop: closes the app, installs and starts the new version (a .deb / .rpm after the system's password prompt; when
 *  that fails the download stays ready and Install can be tapped again). Android: opens Android's installer, which
 *  asks first. */
export async function install(): Promise<void> {
  if (!upd.ready || upd.installing) return;
  upd.error = ""; upd.installing = true;
  try { const d = desktop(); if (d) await d.install(); else await android()?.install!(); }
  catch (e) { upd.error = said(e, "Could not start the installer"); }
  finally { upd.installing = false; }
}

export function setAuto(on: boolean) { upd.auto = on; save(); if (on) void tick(); }
export function setEvery(v: Every) { if (!EVERY_CHOICES.includes(v)) return; upd.every = v; save(); void tick(); }
/** Turning automatic downloads on is a tap: on Android 13+ it may ask once to show the download's notification. */
export async function setAutoDownload(on: boolean) {
  upd.autoDownload = on; save();
  // the desktop app installs a ready download on quit only while automatic downloads are chosen
  void desktop()?.installOnQuit?.(on).catch(() => {});
  if (on) { await askNotify(); void tick(); }
}
export function setWifiOnly(on: boolean) { upd.wifiOnly = on; save(); if (!on) void tick(); }

async function metered(): Promise<boolean | null> {
  const a = android();
  if (!a?.metered) return null;
  const r = (await a.metered().catch(() => null)) as { metered?: unknown } | null;
  return typeof r?.metered === "boolean" ? r.metered : null;
}

let busy = false;
const tick = async () => {
  if (busy) return;
  busy = true;
  try {
    if (checkDue({ auto: upd.auto, every: upd.every, lastCheck: upd.lastCheck, lastFail, checkedThisRun }, Date.now())) await checkNow();
    const s = { auto: upd.auto, autoDownload: upd.autoDownload, latest: upd.latest, mode: upd.mode, ready: upd.ready, downloading: upd.downloading, wifiOnly: upd.wifiOnly, lastFail: lastDlFail };
    if (!autoDownloadDue({ ...s, metered: null }, Date.now())) return;
    // asked only when it matters (a download is due), and only on Android
    if (autoDownloadDue({ ...s, metered: upd.wifiOnly ? await metered() : null }, Date.now())) await download();
  } finally { busy = false; }
};
let running = false;
/** Called by UpdateButton.vue when it mounts (later calls do nothing): in the apps, the automatic checks and
 *  downloads; elsewhere nothing. Starts after the first paint. */
export function startAppUpdates() {
  if (running || !appUpdates()) return;
  running = true;
  void start();
  setTimeout(() => void tick(), 8000);
  // every 15 minutes: whether a check is due, or a waiting download can start (a phone back on Wi-Fi)
  setInterval(() => void tick(), 15 * 60_000);
  addEventListener("online", () => void tick());
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { void refreshNotify(); void tick(); } });
}
