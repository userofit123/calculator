// The Android app (apps/android): the page talks to Capacitor's native bridge directly (window.Capacitor, injected by the
// app before any script runs), so the web build carries no Capacitor code and nothing changes in a browser.
import { sheetIsOpen, closeTopSheet } from "../core/sheets";

type Listener = (cb: (e: never) => void) => unknown;
interface NativePlugin { addListener?: Listener; [m: string]: unknown }
const cap = () => (globalThis as { Capacitor?: { getPlatform?: () => string; Plugins?: Record<string, NativePlugin> } }).Capacitor;
const P = (n: string) => cap()?.Plugins?.[n] as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined> & { addListener?: (ev: string, cb: (e: never) => void) => unknown } | undefined;
export const isAndroid = () => cap()?.getPlatform?.() === "android";

/** Called by main.ts before the theme starts, so the first look already reaches the bars. */
export function installAndroidBridge() {
  if (!isAndroid()) return;
  // Back closes an open sheet, then goes back through the pages, and from the calculator leaves the app (it stays in
  // memory, as with Android's own Back on a home screen app, so the next open is instant)
  P("App")?.addListener?.("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
    if (sheetIsOpen()) closeTopSheet();
    else if (canGoBack && location.pathname !== "/") history.back();
    else void P("App")?.minimizeApp?.();
  });
  // the page runs behind clear status and navigation bars (CalcBarsPlugin), so its background shows under the clock and
  // beside a side bar; it pads itself by the bars' sizes (--nst / --nsb / --nsl / --nsr, used by --st / --sb / --sl /
  // --sr in tokens.css)
  const pad = ({ top, bottom, left = 0, right = 0 }: { top: number; bottom: number; left?: number; right?: number }) => {
    const r = document.documentElement.style;
    r.setProperty("--nst", top + "px"); r.setProperty("--nsb", bottom + "px"); r.setProperty("--nsl", left + "px"); r.setProperty("--nsr", right + "px");
  };
  P("CalcBars")?.addListener?.("insets", pad);
  P("CalcBars")?.insets?.().then((s) => pad(s as Parameters<typeof pad>[0]), () => {});
  // the clock and buttons follow the look, dark or light (theme.ts calls calcApp.setBars); Android reads only #rrggbb,
  // so a short "#abc" is spelled out
  window.calcApp = {
    setBars: (bg: string, dark: boolean) => {
      const c = /^#[0-9a-f]{3}$/i.test(bg) ? "#" + [...bg.slice(1)].map((x) => x + x).join("") : bg;
      if (!/^#[0-9a-f]{6}$/i.test(c)) return;
      P("CalcBars")?.set?.({ bg: c, dark }).catch(() => {});
    },
  };
}
