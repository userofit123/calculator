// The pages and a tiny router (no vue-router: four flat pages don't need one, and the main bundle stays small).
// The address follows the page, so Back, reloads and the installed app's start URL all work.
import { ref, defineAsyncComponent, type Component } from "vue";
import CalculatorPage from "../pages/CalculatorPage.vue";
import { sheetIsOpen, closeTopSheet } from "../core/sheets";
import type { Key } from "../core/i18n";

export type PageName = "calc" | "convert" | "history" | "settings";
interface NavItem { name: PageName; label: Key; icon: string; path: string }

/** The menu (labels are text keys, see core/i18n.ts): the rail on a computer, the bottom tabs on a phone (the same four, in the same order). */
export const NAV: NavItem[] = [
  { name: "calc", label: "nav.calc", icon: "calc", path: "/" },
  { name: "convert", label: "nav.convert", icon: "convert", path: "/converter" },
  { name: "history", label: "nav.history", icon: "history", path: "/history" },
  { name: "settings", label: "nav.settings", icon: "settings", path: "/settings" },
];

// The calculator is in the main bundle (it is the first screen); the rest loads when first opened.
const loaders: Record<Exclude<PageName, "calc">, () => Promise<{ default: Component }>> = {
  convert: () => import("../pages/ConverterPage.vue"),
  history: () => import("../pages/HistoryPage.vue"),
  settings: () => import("../pages/SettingsPage.vue"),
};
export const PAGES: Record<PageName, Component> = {
  calc: CalculatorPage,
  convert: defineAsyncComponent(loaders.convert),
  history: defineAsyncComponent(loaders.history),
  settings: defineAsyncComponent(loaders.settings),
};

// The app may be served below a folder (the copy on GitHub Pages lives at /calculator/): the paths above are inside the
// app, the address bar shows them after BASE_URL ("/" for the desktop and Android apps and a copy at the root).
const BASE = import.meta.env.BASE_URL;
/** The full address of a page, e.g. "/calculator/converter". */
export const href = (name: PageName) => BASE + NAV.find((n) => n.name === name)!.path.slice(1);
const fromPath = (full: string): PageName => {
  const p = full.startsWith(BASE) ? "/" + full.slice(BASE.length) : full;
  return NAV.find((n) => n.path !== "/" && (p === n.path || p.startsWith(n.path + "/")))?.name ?? "calc";
};
export const page = ref<PageName>(fromPath(location.pathname));
// an unknown address opens the calculator and says so in the address bar
if (href(page.value) !== location.pathname) history.replaceState(null, "", href(page.value));

export function go(name: PageName) {
  if (name === page.value) return;
  history.pushState(null, "", href(name));
  page.value = name;
}
// Back closes an open sheet first (the step is put back), otherwise it follows the address
addEventListener("popstate", () => {
  if (sheetIsOpen()) { history.pushState(null, "", href(page.value)); closeTopSheet(); return; }
  page.value = fromPath(location.pathname);
});
