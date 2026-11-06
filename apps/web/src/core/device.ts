// Phone or desktop layout: phone up to 860 px wide (or a touch screen up to 1100 px), unless chosen in Settings.
import { ref } from "vue";
import { readStr, writeStr } from "./prefs";

export type Layout = "auto" | "desktop" | "phone";
const LAYOUTS: readonly string[] = ["auto", "desktop", "phone"] satisfies Layout[];
const saved = readStr("calcLayout", "auto");
export const layoutChoice = ref<Layout>(LAYOUTS.includes(saved) ? (saved as Layout) : "auto");
const auto = () => {
  const w = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
  return w <= 860 || (matchMedia("(pointer:coarse)").matches && w <= 1100);
};
export const isPhone = ref(layoutChoice.value === "auto" ? auto() : layoutChoice.value === "phone");
const update = () => {
  isPhone.value = layoutChoice.value === "auto" ? auto() : layoutChoice.value === "phone";
  document.documentElement.classList.toggle("phone", isPhone.value);
};
addEventListener("resize", update);
export function setLayout(v: Layout) { layoutChoice.value = v; writeStr("calcLayout", v); update(); }
update();

/** The safe-area insets in px as the page uses them (--st / --sb / --sl / --sr in tokens.css: env() or the Android
 *  app's bar sizes), for popups placed by script, so they stop short of the clock and the navigation bar. */
export function safeArea() {
  const p = document.createElement("div");
  p.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:var(--st) var(--sr) var(--sb) var(--sl)";
  document.body.appendChild(p);
  const s = getComputedStyle(p), n = (v: string) => parseFloat(v) || 0;
  const r = { top: n(s.paddingTop), bottom: n(s.paddingBottom), left: n(s.paddingLeft), right: n(s.paddingRight) };
  p.remove();
  return r;
}
