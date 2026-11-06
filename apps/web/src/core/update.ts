// Updates of the built web app, applied without ever disturbing someone in the middle of a sum (public/sw.js has the
// worker's side). A new version waits until the app is next opened or brought back to the screen with nothing typed;
// a page that is open meanwhile keeps running its own version, files and all, also with no connection.
import { calc } from "./calc";
import { sheetIsOpen } from "./sheets";
import { toast } from "./toast";
import { t } from "./i18n";

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

/** Registers the worker and moves to a waiting new version when the app is (re)opened or comes back to the screen idle. */
export function startUpdates(url: string) {
  const sw = navigator.serviceWorker;
  stampInput();
  let asked = false;
  // the worker only takes over early when this is the app's only window, and then this page reloads onto it right away
  sw.addEventListener("controllerchange", () => { if (asked) location.reload(); });
  addEventListener("load", () => {
    sw.register(url, { updateViaCache: "none" }).then((reg) => {
      const apply = () => { if (reg.waiting && sw.controller && idle()) { asked = true; reg.waiting.postMessage("skip"); } };
      apply();
      // a new version usually finishes installing during a visit: look again once it waits, and at idle moments after
      // (never mid-typing: apply() checks idle each time; two idle looks in a row so a pause between keys isn't taken)
      let poll = 0, calm = false;
      const watchWaiting = () => {
        if (poll || asked) return;
        poll = window.setInterval(() => {
          if (asked || !reg.waiting) { clearInterval(poll); poll = 0; return; }
          if (document.visibilityState !== "visible") { calm = false; return; }
          if (idle()) { if (calm) apply(); calm = true; } else calm = false;
        }, 15_000);
      };
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed") watchWaiting(); });
      };
      if (reg.waiting) watchWaiting();
      track(reg.installing);
      reg.addEventListener("updatefound", () => track(reg.installing));
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        apply();
        // a long-open installed app also looks for a new version when it comes back; with no connection nothing happens
        reg.update().catch(() => {});
      });
    }).catch(() => { /* not installable here, nothing else changes */ });
  });
}
