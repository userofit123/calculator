// The app's languages: English (always here, in the main bundle) and the others in i18n/langs.ts (each a chunk of its
// own, loaded only when it is chosen, and precached by the service worker so it is there offline at once). Hebrew and
// Arabic are right to left. No library: t("key", { n: 3 }) looks the key up in the chosen language, falling back to
// English. The choice is "auto" (the best of the browser's languages) or a language code, kept on this device under
// "calcLang". The page's lang and dir are set before the first paint by index.html's inline script (same rule as
// resolveLang below); main.ts waits for the chosen language's texts before mounting, so the first paint is already in
// that language. Numbers, the keypad, expressions and dates stay left to right with Latin digits in every language
// (styles: the [dir] rules in base.css; texts: params with digits are isolated in right-to-left text, see iso()).
import { computed, ref, shallowRef } from "vue";
import { EN, type Key } from "../i18n/en";
import { LANG_INFO, LOADERS, bestLang, htmlLang, isLang, type Lang, type LangPack, type Unit } from "../i18n/langs";
import { readStr, writeStr } from "./prefs";

export type { Key } from "../i18n/en";
export type { Lang, Unit } from "../i18n/langs";
export type LangChoice = "auto" | Lang;
export const LANG_KEY = "calcLang";

const browserLangs = (): readonly string[] => {
  const n = globalThis.navigator;
  return n?.languages?.length ? n.languages : [n?.language ?? "en"];
};
/** The language a choice means: a language code as it is; Auto the best of the browser's languages (else English) */
export function resolveLang(choice: string | null | undefined, browser: string | readonly string[] = browserLangs()): Lang {
  if (isLang(choice)) return choice;
  return bestLang(typeof browser === "string" ? [browser] : browser);
}

const saved = readStr(LANG_KEY, "auto");
export const langChoice = ref<LangChoice>(isLang(saved) ? saved : "auto");
/** The language shown now (English until the chosen language's texts are here) */
export const lang = ref<Lang>("en");
/** The language shown is right to left */
export const rtl = computed(() => !!LANG_INFO[lang.value].rtl);
const pack = shallowRef<LangPack | null>(null);
/** English: the main bundle's texts, plus each lazy part's once it has loaded (useTexts) */
const en = shallowRef<Partial<Record<Key, string>>>(EN);
/** A lazily loaded page or form adds its English texts (a no-op after the first time) */
export function useTexts(texts: Partial<Record<Key, string>>) {
  const first = Object.keys(texts)[0] as Key | undefined;
  if (first && !(first in en.value)) en.value = { ...en.value, ...texts };
}

// Left-to-right isolates (LRI … PDI) keep "12.5 km" or "-3" in their own order inside a right-to-left sentence
const LRI = "\u2066", PDI = "\u2069";
// Right-to-left letters (Hebrew, Arabic, Syriac, Thaana, NKo, …, and their presentation forms)
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
/** A value that has digits or Latin letters, kept left to right inside right-to-left text. A value that has right-to-left
 *  letters of its own (a Hebrew date "6 בנוב׳ 2026", a text already filled in, what the user typed in Hebrew or Arabic) is
 *  left as it is: isolated left to right, its words would read backwards. */
export const iso = (v: unknown) => { const s = String(v); return rtl.value && /[\dA-Za-z]/.test(s) && !RTL.test(s) ? LRI + s + PDI : s; };

// In a right-to-left text, a run of numbers, Latin words and maths ("×10ⁿ", "1.2345×10³", "5 km in mi", "Ctrl+E") is kept
// left to right as one piece; otherwise its symbols would be placed by the text around it (10³×1.2345). A leading
// minus ("-1", "(-100%)") belongs to the number, but not a hyphen joined to a Hebrew word ("ל-1").
const RUN = /(?:(?<![\p{L}\p{N}])[-−]|[×÷])?[0-9A-Za-z⁰¹²³⁴-⁹ⁿ⁻ˣʸ](?:[0-9A-Za-z⁰¹²³⁴-⁹ⁿ⁻ˣʸ.,:/×÷^+−%()' ]*[0-9A-Za-z⁰¹²³⁴-⁹ⁿˣʸ%])?/gu;
const wrapRun = (m: string) => (/[\d×÷^+−/:.,]|\s\S/.test(m) ? LRI + m + PDI : m);
const count = (s: string, c: string) => s.split(c).length - 1;
// a run with a bracket left open ("1 (100%" of "ל-1 (100%)") is split at its brackets: a bracket closed outside the
// isolate would be mirrored by the Hebrew around it
const isoRuns = (s: string): string => s.replace(RUN, (m) => (count(m, "(") === count(m, ")") ? wrapRun(m)
  : m.split(/([()])/).map((p) => (p === "(" || p === ")" ? p : isoRuns(p))).join("")));

export type Params = Record<string, string | number>;
/** The text for a key in the language shown, with {name} filled in from params */
export function t(key: Key, params?: Params): string {
  const h = lang.value !== "en" ? pack.value?.dict[key] : undefined;
  const s = h === undefined ? en.value[key] ?? key : rtl.value ? isoRuns(h) : h;
  // a "%" right after a value goes into its isolate ("50%"), else the right-to-left text around it would put it first ("%50")
  return params ? s.replace(/\{(\w+)\}(%?)/g, (m, k: string, pct: string) => (k in params ? iso(String(params[k]) + pct) : m)) : s;
}
/** For a key built at runtime (a unit id, a mode id): its text, or `fallback` when there is no such key */
export function tMaybe(key: string, fallback: string, params?: Params): string {
  return key in en.value ? t(key as Key, params) : fallback;
}
/** A name put inside a sentence ("Copy tip", "Search currency"): in lower case where the language does that (not German
 *  nouns, nor scripts without case), by the language's own rules (Turkish İ/ı) */
export const lower = (s: string) => (LANG_INFO[lang.value].keepCase ? s : s.toLocaleLowerCase(LANG_INFO[lang.value].locale));

/** A unit's name (from @calc/core, in English) in the language shown, by its id */
export const unitName = (id: string, english: string) => (lang.value === "en" ? english : pack.value?.units[id] ?? english);
/** A currency's name in the language shown (Intl knows them all), by its code */
export function currencyName(code: string, english: string): string {
  if (lang.value === "en") return english;
  try { return new Intl.DisplayNames([LANG_INFO[lang.value].locale], { type: "currency" }).of(code) ?? english; } catch { return english; }
}
/** A list of names in the language shown: "a and b" in English, "a, b" / "a y b" … by Intl elsewhere */
export function listOf(items: string[]): string {
  if (lang.value === "en") return items.join(" and ");
  try { return new Intl.ListFormat(LANG_INFO[lang.value].locale, { type: "conjunction" }).format(items); } catch { return items.join(", "); }
}

/** The page's language and direction (the same as index.html's script sets before the first paint) */
export function applyLang(l: Lang, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.lang = htmlLang(l);
  root.dir = LANG_INFO[l].rtl ? "rtl" : "ltr";
}
/** The locale for Intl (dates, weekday and month names): the browser's own for English, as before */
export const locale = () => (lang.value === "en" ? undefined : LANG_INFO[lang.value].locale);

const loading = new Map<Lang, Promise<LangPack>>();
const load = (l: Exclude<Lang, "en">) => {
  let p = loading.get(l);
  if (!p) { p = LOADERS[l]().then((m) => m.default); p.catch(() => loading.delete(l)); loading.set(l, p); }
  return p;
};

let wanted: Lang = "en";
async function show(l: Lang) {
  wanted = l;
  let next: LangPack | null = null;
  if (l !== "en") {
    try { next = await load(l); } catch { if (wanted === l) { lang.value = "en"; pack.value = null; applyLang("en"); } return; }
  }
  if (wanted !== l) return; // a later choice won
  pack.value = next; lang.value = l; applyLang(l);
}
/** The language wanted is still loading (main.ts: mount in English after a while rather than wait on) */
export const stillLoading = () => wanted !== lang.value;
/** Ready to mount: the saved language's texts are here (a chunk is awaited; English needs nothing) */
export const i18nReady: Promise<void> = show(resolveLang(langChoice.value));

/** Settings → Language: switches at once (no reload) and is remembered */
export function setLang(c: LangChoice) {
  langChoice.value = c; writeStr(LANG_KEY, c);
  return show(resolveLang(c));
}
// Auto follows the browser's language when it changes
globalThis.addEventListener?.("languagechange", () => { if (langChoice.value === "auto") void show(resolveLang("auto")); });

// ---- counted words: "1 day" / "2 days"; other languages by their plural rules (Intl.PluralRules): Russian "1 день",
// "2 дня", "5 дней"; Hebrew has its own words for one and two ("יום אחד", "יומיים") ----
const rules = new Map<string, Intl.PluralRules>();
/** "3 days", "1 day" (as @calc/core's dates.ts words them); in Hebrew "3 ימים", "יום אחד", "יומיים" */
export function plural(n: number, u: Unit): string {
  const p = lang.value !== "en" ? pack.value : null;
  if (!p) return `${n} ${u}${n === 1 ? "" : "s"}`;
  const loc = LANG_INFO[lang.value].locale, a = Math.abs(n);
  let r = rules.get(loc);
  if (!r) rules.set(loc, (r = new Intl.PluralRules(loc)));
  const f = p.count[u][r.select(a)] ?? p.count[u].other;
  // a form that is the whole phrase ("יום אחד") takes the sign in front
  return f.includes("{n}") ? f.replace("{n}", iso(n)) : (n < 0 ? "-" : "") + f;
}
const sep = () => (lang.value !== "en" ? pack.value?.sep : undefined) ?? ", ";
// The date words of @calc/core (describeYMD, describeWeeks, describeDays, describeDuration) in the language shown:
// the same parts and rules, only worded here, so English reads exactly as before.
/** "2 years, 3 months, 4 days" (parts that are 0 left out; "0 days" when all are) */
export function describeYMD(v: { years: number; months: number; days: number }): string {
  const parts: string[] = [];
  if (v.years) parts.push(plural(v.years, "year"));
  if (v.months) parts.push(plural(v.months, "month"));
  if (v.days || !parts.length) parts.push(plural(v.days, "day"));
  return parts.join(sep());
}
/** "6 weeks, 3 days" */
export function describeWeeks(days: number): string {
  const n = Math.abs(days), w = Math.floor(n / 7), d = n % 7;
  return w ? (d ? plural(w, "week") + sep() + plural(d, "day") : plural(w, "week")) : plural(d, "day");
}
export const describeDays = (n: number) => plural(n, "day");
/** "1 day, 2 hours, 5 minutes" for a duration in seconds (parts that are 0 left out) */
export function describeDuration(sec: number): string {
  const n = Math.abs(Math.round(sec)), d = Math.floor(n / 86400), h = Math.floor((n % 86400) / 3600), mi = Math.floor((n % 3600) / 60), se = n % 60;
  const parts = ([[d, "day"], [h, "hour"], [mi, "minute"], [se, "second"]] as [number, Unit][]).filter(([v]) => v).map(([v, w]) => plural(v, w));
  return (sec < 0 ? t("dur.minus") + " " : "") + (parts.length ? parts.join(sep()) : plural(0, "minute"));
}
