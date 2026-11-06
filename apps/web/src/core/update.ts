// Updates of the built web app, applied without ever disturbing someone in the middle of a sum (public/sw.js has the
// worker's side). A new version waits until the app is next opened or brought back to the screen with nothing typed;
// a page that is open meanwhile keeps running its own version, files and all, also with no connection.
import { calc } from "./calc";
import { sheetIsOpen } from "./sheets";

// nothing typed and no sheet open: reloading now loses nothing the person is looking at
const idle = () => !calc.expr && !sheetIsOpen();

function readNum(k: string): number { try { return Number(sessionStorage.getItem(k) ?? 0); } catch { return 0; } }
function writeNum(k: string, v: number) { try { sessionStorage.setItem(k, String(v)); } catch { /* private mode: the guard is per page then */ } }

/** The safety net, for every copy of the app: a part of it that can't be loaded (a page left open across an update
 *  asking for files the server no longer has) reloads the page once, onto the version now there. At most once a
 *  minute, so a part that is really missing shows its error instead of reloading for ever. */
export function startReloadOnMissingFiles() {
  addEventListener("vite:preloadError", (e) => {
    const now = Date.now();
    if (now - readNum("calcReloadAt") < 60_000) return;
    writeNum("calcReloadAt", now);
    e.preventDefault();
    location.reload();
  });
}

/** Registers the worker and moves to a waiting new version when the app is (re)opened or comes back to the screen idle. */
export function startUpdates(url: string) {
  const sw = navigator.serviceWorker;
  let asked = false;
  // the worker only takes over early when this is the app's only window, and then this page reloads onto it right away
  sw.addEventListener("controllerchange", () => { if (asked) location.reload(); });
  addEventListener("load", () => {
    sw.register(url, { updateViaCache: "none" }).then((reg) => {
      const apply = () => { if (reg.waiting && sw.controller && idle()) { asked = true; reg.waiting.postMessage("skip"); } };
      apply();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        apply();
        // a long-open installed app also looks for a new version when it comes back; with no connection nothing happens
        reg.update().catch(() => {});
      });
    }).catch(() => { /* not installable here, nothing else changes */ });
  });
}
