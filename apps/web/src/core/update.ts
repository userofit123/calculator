// Updates of the built web app, applied without ever disturbing someone in the middle of a sum (public/sw.js has the
// worker's side). A new version waits until the app is next opened or brought back to the screen with nothing typed;
// a page that is open meanwhile keeps running its own version, files and all, also with no connection.
import { calc } from "./calc";
import { sheetIsOpen } from "./sheets";
import { toast } from "./toast";
import { t } from "./i18n";
import { reactive } from "vue";
import { upd, GAP, noteCheck, type Every } from "./appUpdate";

/** The minimal shape of document.activeElement that matters here (kept structural so isIdle stays pure and testable). */
export interface ActiveLike { tagName?: string; type?: string; isContentEditable?: boolean }
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "range", "button", "submit", "reset", "image", "file", "color"]);
/** Whether the focused element is somewhere text is typed: a text-like input, textarea, select or contenteditable. */
export function isEditing(el: ActiveLike | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return tag === "INPUT" && !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
}
const RECENT_INPUT_MS = 5000;

/** Idle = nothing being typed and no sheet open. An answer showing after = counts as idle too (calc.expr still holds the
 *  sum, but History keeps the result), so a phone app left on an answer can update. Also busy: a text field, search box
 *  or select has focus (Converter amount, unit search, Settings, ...), or a key/input happened in the last 5 s. */
export function isIdle(s: { expr: string; answer: string; sheet: boolean; active?: ActiveLike | null; lastInput?: number; now?: number }): boolean {
  if (s.sheet || isEditing(s.active)) return false;
  if (s.lastInput && s.now !== undefined && s.now - s.lastInput < RECENT_INPUT_MS) return false;
  return !s.expr || !!s.answer;
}
let lastInput = 0;
let stamping = false;
function stampInput() {
  if (stamping || typeof document === "undefined") return;
  stamping = true;
  const f = () => { lastInput = Date.now(); };
  document.addEventListener("keydown", f, { passive: true, capture: true });
  document.addEventListener("input", f, { passive: true, capture: true });
}
const idle = () => isIdle({ expr: calc.expr, answer: calc.answer, sheet: sheetIsOpen(), active: document.activeElement as ActiveLike | null, lastInput, now: Date.now() });

type Store = Pick<Storage, "getItem" | "setItem">;
/** Whether a reload for a missing file may go ahead: at most once a minute, and only when the stamp could really be
 *  written (read back). With storage that throws the guard would always read 0 and reload for ever, so then: no. */
export function reloadDecision(store: () => Store, now: number): "reload" | "wait" | "unwritable" {
  try {
    const st = store();
    if (now - Number(st.getItem("calcReloadAt") ?? 0) < 60_000) return "wait";
    st.setItem("calcReloadAt", String(now));
    return st.getItem("calcReloadAt") === String(now) ? "reload" : "unwritable";
  } catch { return "unwritable"; }
}

/** The safety net, for every copy of the app: a part of it that can't be loaded (a page left open across an update
 *  asking for files the server no longer has) reloads the page once, onto the version now there. At most once a
 *  minute, so a part that is really missing shows its error instead of reloading for ever. */
export function startReloadOnMissingFiles() {
  addEventListener("vite:preloadError", (e) => {
    const d = reloadDecision(() => sessionStorage, Date.now());
    if (d === "wait") return;
    e.preventDefault();
    if (d === "unwritable") { toast(t("msg.reopen"), { ms: 8000 }); return; }
    location.reload();
  });
}

/** Settings → App & updates in the web app / PWA (C-52): what Check now found. "": not checked by hand yet; "latest": no
 *  newer version; "downloading": the new version's files are being kept (public/sw.js tells how far: `progress`, 0-1,
 *  null until known); "ready": a new version is installed and waits (Restart applies it, else the next open does); "error":
 *  the check failed (offline, server not answering); "none": no service worker here (the development server, or a
 *  browser without one), so there is nothing to update. */
export const webUpd = reactive({ checking: false, state: "" as "" | "latest" | "downloading" | "ready" | "error" | "none", progress: null as number | null });
let reg: ServiceWorkerRegistration | null = null;
let asked = false;
/** Whether a scheduled check of the web app is due (Settings → How often): "open" each time the app is opened or
 *  brought back to the screen, else once the chosen time has passed since the last check that got an answer. */
export function webCheckDue(every: Every, lastCheck: number, now: number, opening: boolean): boolean {
  return every === "open" ? opening : now - lastCheck >= GAP[every];
}
/** Waits until a worker the check found has finished installing, at most `ms`: its last state ("" when none was found;
 *  "redundant" when it failed, such as a file that couldn't be downloaded). */
function settled(r: ServiceWorkerRegistration, ms = 60_000): Promise<string> {
  const w = r.installing;
  if (!w) return Promise.resolve("");
  return new Promise((done) => {
    const t0 = setTimeout(() => done(w.state), ms);
    w.addEventListener("statechange", () => { if (w.state !== "installing") { clearTimeout(t0); done(w.state); } });
  });
}
/** Asks the server for the app's worker again (registration.update()): a changed one installs the new version in the
 *  background. Only from Check now and the schedule; it never reloads the page by itself (the idle rules below do). */
export async function checkWebNow(): Promise<void> {
  if (webUpd.checking) return;
  webUpd.checking = true;
  try {
    reg ??= (await navigator.serviceWorker?.getRegistration().catch(() => undefined)) ?? null;
    if (!reg) { webUpd.state = "none"; return; }
    await reg.update();
    if ((await settled(reg)) === "redundant") throw new Error("the new version didn't install");
    noteCheck();
    webUpd.state = reg.waiting ? "ready" : "latest";
  } catch { webUpd.state = "error"; } finally { webUpd.checking = false; webUpd.progress = null; }
}
/** Restart in Settings: the waiting version takes over now and the page reloads onto it (the worker agrees only when
 *  this is the app's only window; else it applies the next time the app is opened, as the hint says). */
export function restartWeb() {
  if (!reg?.waiting) return;
  asked = true;
  reg.waiting.postMessage("skip");
}
/** A scheduled check, quietly: its answer shows in Settings only as "Checked ..." and a ready version. */
async function scheduledCheck(opening: boolean) {
  if (!reg || webUpd.checking || document.visibilityState !== "visible") return;
  if (!webCheckDue(upd.every, upd.lastCheck, Date.now(), opening)) return;
  try { await reg.update(); noteCheck(); if (reg.waiting) webUpd.state = "ready"; } catch { /* offline: the next one tries again */ }
}

/** Registers the worker and moves to a waiting new version when the app is (re)opened or comes back to the screen idle. */
export function startUpdates(url: string) {
  const sw = navigator.serviceWorker;
  stampInput();
  // the worker only takes over early when this is the app's only window, and then this page reloads onto it right away
  sw.addEventListener("controllerchange", () => { if (asked) location.reload(); });
  // how far a new version's worker is with keeping its files (public/sw.js, precache): only an update counts, not the
  // very first install (no worker controls this page yet), and only a sensible share
  sw.addEventListener("message", (e) => {
    const p = (e.data as { calcInstall?: unknown } | null)?.calcInstall;
    // only from the worker installing right now: a failed one may still post a late share after the page gave up on it
    if (!reg || e.source !== reg.installing) return;
    if (!sw.controller || webUpd.state === "ready" || typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) return;
    webUpd.state = "downloading"; webUpd.progress = p;
  });
  sw.startMessages();
  addEventListener("load", () => {
    sw.register(url, { updateViaCache: "none" }).then((r) => {
      reg = r;
      // registering checks the server for a new worker by itself, so this open counts as a check
      noteCheck();
      const apply = () => { if (r.waiting && sw.controller && idle()) { asked = true; r.waiting.postMessage("skip"); } };
      apply();
      // a new version usually finishes installing during a visit: look again once it waits, and at idle moments after
      // (never mid-typing: apply() checks idle each time; two idle looks in a row so a pause between keys isn't taken)
      let poll = 0, calm = false;
      const watchWaiting = () => {
        if (poll || asked) return;
        poll = window.setInterval(() => {
          if (asked || !r.waiting) { clearInterval(poll); poll = 0; return; }
          if (document.visibilityState !== "visible") { calm = false; return; }
          if (idle()) { if (calm) apply(); calm = true; } else calm = false;
        }, 15_000);
      };
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed") { webUpd.progress = null; if (r.waiting) webUpd.state = "ready"; watchWaiting(); }
          // the new version couldn't be kept (Check now says so; otherwise the next check tries again)
          else if (w.state === "redundant") { webUpd.progress = null; if (webUpd.state === "downloading") webUpd.state = ""; }
        });
      };
      if (r.waiting) { webUpd.state = "ready"; watchWaiting(); }
      track(r.installing);
      r.addEventListener("updatefound", () => track(r.installing));
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        apply();
        // a long-open installed app also looks for a new version when it comes back, as often as Settings says
        // (How often); with no connection nothing happens
        void scheduledCheck(true);
      });
      // and while it stays open: every 15 minutes, whether the chosen time has passed
      setInterval(() => void scheduledCheck(false), 15 * 60_000);
    }).catch(() => { /* not installable here, nothing else changes */ });
  });
}
