// The app's languages: English (always here, in the main bundle) and Hebrew (right to left; its texts are a chunk of
// their own, loaded only when Hebrew is chosen, and precached by the service worker so it is there offline at once).
// No library: t("key", { n: 3 }) looks the key up in the chosen language, falling back to English. The choice is
// "auto" (the browser's language), "en" or "he", kept on this device under "calcLang". The page's lang and dir are set
// before the first paint by index.html's inline script (same rule as resolveLang below); main.ts waits for the Hebrew
// texts before mounting, so the first paint is already in Hebrew. Numbers, the keypad, expressions and dates stay left
// to right (styles: the [dir] rules in base.css; texts: params with digits are isolated, see iso()).
import { ref, shallowRef } from "vue";
import { EN, type Key } from "../i18n/en";
import { readStr, writeStr } from "./prefs";

export type { Key } from "../i18n/en";
export type Lang = "en" | "he";
export type LangChoice = "auto" | Lang;
export const LANG_KEY = "calcLang";
const CHOICES: readonly string[] = ["auto", "en", "he"] satisfies LangChoice[];

/** The language a choice means: Auto follows the browser (he, or the old code iw), else English */
export function resolveLang(choice: string | null | undefined, browser = globalThis.navigator?.language ?? "en"): Lang {
  if (choice === "en" || choice === "he") return choice;
  return /^(he|iw)\b/i.test(browser) ? "he" : "en";
}

const saved = readStr(LANG_KEY, "auto");
export const langChoice = ref<LangChoice>(CHOICES.includes(saved) ? (saved as LangChoice) : "auto");
/** The language shown now (English until the Hebrew texts are here) */
export const lang = ref<Lang>("en");
const he = shallowRef<Partial<Record<Key, string>> | null>(null);
/** English: the main bundle's texts, plus each lazy part's once it has loaded (useTexts) */
const en = shallowRef<Partial<Record<Key, string>>>(EN);
/** A lazily loaded page or form adds its English texts (a no-op after the first time) */
export function useTexts(texts: Partial<Record<Key, string>>) {
  const first = Object.keys(texts)[0] as Key | undefined;
  if (first && !(first in en.value)) en.value = { ...en.value, ...texts };
}
const heUnits = shallowRef<Record<string, string>>({});

// Left-to-right isolates (LRI … PDI) keep "12.5 km" or "-3" in their own order inside a Hebrew sentence
const LRI = "⁦", PDI = "⁩";
/** A value that has digits or Latin letters, kept left to right inside right-to-left text */
export const iso = (v: unknown) => { const s = String(v); return lang.value === "he" && /[\dA-Za-z]/.test(s) ? LRI + s + PDI : s; };

// In a Hebrew text, a run of numbers, Latin words and maths ("×10ⁿ", "1.2345×10³", "5 km in mi", "Ctrl+E") is kept
// left to right as one piece; otherwise its symbols would be placed by the Hebrew around it (10³×1.2345).
const RUN = /[×÷]?[0-9A-Za-z⁰¹²³⁴-⁹ⁿ⁻ˣʸ](?:[0-9A-Za-z⁰¹²³⁴-⁹ⁿ⁻ˣʸ.,:/×÷^+−%()' ]*[0-9A-Za-z⁰¹²³⁴-⁹ⁿˣʸ%])?/g;
const isoRuns = (s: string) => s.replace(RUN, (m) => (/[\d×÷^+−/:.,]|\s\S/.test(m) ? LRI + m + PDI : m));

export type Params = Record<string, string | number>;
/** The text for a key in the language shown, with {name} filled in from params */
export function t(key: Key, params?: Params): string {
  const h = lang.value === "he" ? he.value?.[key] : undefined;
  const s = h !== undefined ? isoRuns(h) : en.value[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? iso(params[k]) : m)) : s;
}
/** For a key built at runtime (a unit id, a mode id): its text, or `fallback` when there is no such key */
export function tMaybe(key: string, fallback: string, params?: Params): string {
  return key in en.value ? t(key as Key, params) : fallback;
}

/** A unit's name (from @calc/core, in English) in the language shown, by its id */
export const unitName = (id: string, english: string) => (lang.value === "he" ? heUnits.value[id] ?? english : english);
/** A currency's name in the language shown (Intl knows them all), by its code */
export function currencyName(code: string, english: string): string {
  if (lang.value !== "he") return english;
  try { return new Intl.DisplayNames(["he"], { type: "currency" }).of(code) ?? english; } catch { return english; }
}

/** The page's language and direction (the same as index.html's script sets before the first paint) */
export function applyLang(l: Lang, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.lang = l;
  root.dir = l === "he" ? "rtl" : "ltr";
}
/** The locale for Intl (dates, weekday and month names) */
export const locale = () => (lang.value === "he" ? "he-IL" : undefined);

let heP: Promise<void> | null = null;
const loadHe = () => (heP ??= import("../i18n/he").then((m) => { heUnits.value = m.HE_UNITS; he.value = m.HE; }, (e) => { heP = null; throw e; }));

let wanted: Lang = "en";
async function show(l: Lang) {
  wanted = l;
  if (l === "he") { try { await loadHe(); } catch { if (wanted === l) { lang.value = "en"; applyLang("en"); } return; } }
  if (wanted !== l) return; // a later choice won
  lang.value = l; applyLang(l);
}
/** Ready to mount: the saved language's texts are here (Hebrew is awaited; English needs nothing) */
export const i18nReady: Promise<void> = show(resolveLang(langChoice.value));

/** Settings → Language: switches at once (no reload) and is remembered */
export function setLang(c: LangChoice) {
  langChoice.value = c; writeStr(LANG_KEY, c);
  return show(resolveLang(c));
}
// Auto follows the browser's language when it changes
globalThis.addEventListener?.("languagechange", () => { if (langChoice.value === "auto") void show(resolveLang("auto")); });

// ---- counted words: "1 day" / "2 days"; Hebrew has its own forms for 1 and 2 ("יום אחד", "יומיים") ----
export type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";
const HE_FORMS: Record<Unit, [one: string, two: string, many: string]> = {
  year: ["שנה אחת", "שנתיים", "שנים"],
  month: ["חודש אחד", "חודשיים", "חודשים"],
  week: ["שבוע אחד", "שבועיים", "שבועות"],
  day: ["יום אחד", "יומיים", "ימים"],
  hour: ["שעה אחת", "שעתיים", "שעות"],
  minute: ["דקה אחת", "שתי דקות", "דקות"],
  second: ["שנייה אחת", "שתי שניות", "שניות"],
};
/** "3 days", "1 day" (as @calc/core's dates.ts words them); in Hebrew "3 ימים", "יום אחד", "יומיים" */
export function plural(n: number, u: Unit): string {
  const a = Math.abs(n);
  if (lang.value === "he") {
    const f = HE_FORMS[u], sign = n < 0 ? "-" : "";
    return a === 1 ? sign + f[0] : a === 2 ? sign + f[1] : `${iso(n)} ${f[2]}`;
  }
  return `${n} ${u}${n === 1 ? "" : "s"}`;
}
// The date words of @calc/core (describeYMD, describeWeeks, describeDays, describeDuration) in the language shown:
// the same parts and rules, only worded here, so English reads exactly as before.
/** "2 years, 3 months, 4 days" (parts that are 0 left out; "0 days" when all are) */
export function describeYMD(v: { years: number; months: number; days: number }): string {
  const parts: string[] = [];
  if (v.years) parts.push(plural(v.years, "year"));
  if (v.months) parts.push(plural(v.months, "month"));
  if (v.days || !parts.length) parts.push(plural(v.days, "day"));
  return parts.join(", ");
}
/** "6 weeks, 3 days" */
export function describeWeeks(days: number): string {
  const n = Math.abs(days), w = Math.floor(n / 7), d = n % 7;
  return w ? (d ? `${plural(w, "week")}, ${plural(d, "day")}` : plural(w, "week")) : plural(d, "day");
}
export const describeDays = (n: number) => plural(n, "day");
/** "1 day, 2 hours, 5 minutes" for a duration in seconds (parts that are 0 left out) */
export function describeDuration(sec: number): string {
  const n = Math.abs(Math.round(sec)), d = Math.floor(n / 86400), h = Math.floor((n % 86400) / 3600), mi = Math.floor((n % 3600) / 60), se = n % 60;
  const parts = ([[d, "day"], [h, "hour"], [mi, "minute"], [se, "second"]] as [number, Unit][]).filter(([v]) => v).map(([v, w]) => plural(v, w));
  return (sec < 0 ? (lang.value === "he" ? "מינוס " : "minus ") : "") + (parts.length ? parts.join(", ") : plural(0, "minute"));
}
