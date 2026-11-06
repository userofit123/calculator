// The pages and a tiny router (no vue-router: four flat pages don't need one, and the main bundle stays small).
// The address follows the page, so Back, reloads and the installed app's start URL all work.
import { ref, defineAsyncComponent, type Component } from "vue";
import CalculatorPage from "../pages/CalculatorPage.vue";
import { sheetIsOpen, closeTopSheet } from "../core/sheets";

export type PageName = "calc" | "convert" | "history" | "settings";
export interface NavItem { name: PageName; label: string; icon: string; path: string }

/** The menu: the rail on a computer, the bottom tabs on a phone (the same four, in the same order). */
export const NAV: NavItem[] = [
  { name: "calc", label: "Calculator", icon: "calc", path: "/" },
  { name: "convert", label: "Converter", icon: "convert", path: "/converter" },
  { name: "history", label: "History", icon: "history", path: "/history" },
  { name: "settings", label: "Settings", icon: "settings", path: "/settings" },
];

// The calculator is in the main bundle (it is the first screen); the rest loads when first opened.
export const loaders: Record<Exclude<PageName, "calc">, () => Promise<{ default: Component }>> = {
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

const fromPath = (p: string): PageName => NAV.find((n) => n.path !== "/" && (p === n.path || p.startsWith(n.path + "/")))?.name ?? "calc";
export const page = ref<PageName>(fromPath(location.pathname));
// an unknown address opens the calculator and says so in the address bar
if (NAV.find((n) => n.name === page.value)!.path !== location.pathname) history.replaceState(null, "", NAV.find((n) => n.name === page.value)!.path);

export function go(name: PageName) {
  if (name === page.value) return;
  history.pushState(null, "", NAV.find((n) => n.name === name)!.path);
  page.value = name;
}
// Back closes an open sheet first (the step is put back), otherwise it follows the address
addEventListener("popstate", () => {
  if (sheetIsOpen()) { history.pushState(null, "", NAV.find((n) => n.name === page.value)!.path); closeTopSheet(); return; }
  page.value = fromPath(location.pathname);
});
