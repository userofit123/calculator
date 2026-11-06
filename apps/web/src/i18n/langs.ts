// The app's languages: a small list in the main bundle (code, own name, direction, …) and, for each language but
// English, a loader for its chunk (i18n/<code>.ts: its texts, unit names and counted words). Vite makes every import()
// below a chunk of its own, so a language's texts are downloaded only when it is chosen (and precached by the service
// worker, so they are there offline). index.html's boot script repeats the codes and the right-to-left ones (CODES, RTL):
// keep them in step (test/i18n.test.ts checks).
import type { Key } from "./en";

export type Lang = "en" | "he" | "ar" | "es" | "fr" | "de" | "pt" | "it" | "nl" | "pl" | "ru" | "uk" | "tr" | "hi" | "zh" | "ja" | "ko" | "id" | "vi";
/** The words counted in dates and durations (core/i18n.ts plural) */
export type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";
/** A counted word by plural category (Intl.PluralRules of the language): "{n} days"; "other" is always there. A form
 *  without {n} is the whole phrase ("יום אחד", "יומיים"). */
export type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
/** What a language chunk holds */
export interface LangPack {
  /** every text, by the English keys */
  dict: Record<Key, string>;
  /** unit names by @calc/core unit id (currencies are named by Intl.DisplayNames) */
  units: Record<string, string>;
  /** "{n} days" and the like */
  count: Record<Unit, Forms>;
  /** between the parts of "2 years, 3 months" (", " when not given) */
  sep?: string;
}

export interface LangInfo {
  code: Lang;
  /** the language's name in itself, as the picker shows it */
  name: string;
  /** the locale for Intl (dates, plural rules, currency names). Arabic keeps Latin digits (-u-nu-latn), like the
   *  calculator's own numbers. Also the page's lang attribute, so the system picks the right CJK font. */
  locale: string;
  rtl?: true;
  /** a decimal comma is usual: the first-run default of Settings → Decimal mark */
  comma?: true;
  /** a name inside a sentence is not put in lower case (German nouns; scripts without case don't need it either) */
  keepCase?: true;
}

// English first, then by the language's own name as the picker sorts them
export const LANGS: readonly LangInfo[] = [
  { code: "en", name: "English", locale: "en" },
  { code: "id", name: "Bahasa Indonesia", locale: "id", comma: true },
  { code: "de", name: "Deutsch", locale: "de", comma: true, keepCase: true },
  { code: "es", name: "Español", locale: "es", comma: true },
  { code: "fr", name: "Français", locale: "fr", comma: true },
  { code: "it", name: "Italiano", locale: "it", comma: true },
  { code: "nl", name: "Nederlands", locale: "nl", comma: true },
  { code: "pl", name: "Polski", locale: "pl", comma: true },
  { code: "pt", name: "Português (Brasil)", locale: "pt-BR", comma: true },
  { code: "vi", name: "Tiếng Việt", locale: "vi", comma: true },
  { code: "tr", name: "Türkçe", locale: "tr", comma: true },
  { code: "ru", name: "Русский", locale: "ru", comma: true },
  { code: "uk", name: "Українська", locale: "uk", comma: true },
  { code: "he", name: "עברית", locale: "he-IL", rtl: true, keepCase: true },
  { code: "ar", name: "العربية", locale: "ar-u-nu-latn", rtl: true, keepCase: true },
  { code: "hi", name: "हिन्दी", locale: "hi-IN", keepCase: true },
  { code: "zh", name: "中文 (简体)", locale: "zh-CN", keepCase: true },
  { code: "ja", name: "日本語", locale: "ja", keepCase: true },
  { code: "ko", name: "한국어", locale: "ko", keepCase: true },
];
export const LANG_INFO = Object.fromEntries(LANGS.map((l) => [l.code, l])) as Record<Lang, LangInfo>;
export const isLang = (s: unknown): s is Lang => typeof s === "string" && s in LANG_INFO;

/** Each language's chunk (English is in the main bundle) */
export const LOADERS: Record<Exclude<Lang, "en">, () => Promise<{ default: LangPack }>> = {
  he: () => import("./he"),
  ar: () => import("./ar"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  de: () => import("./de"),
  pt: () => import("./pt"),
  it: () => import("./it"),
  nl: () => import("./nl"),
  pl: () => import("./pl"),
  ru: () => import("./ru"),
  uk: () => import("./uk"),
  tr: () => import("./tr"),
  hi: () => import("./hi"),
  zh: () => import("./zh"),
  ja: () => import("./ja"),
  ko: () => import("./ko"),
  id: () => import("./id"),
  vi: () => import("./vi"),
};

/** The page's lang attribute: the code, with the region where the texts are of one ("pt-BR", "zh-CN": Simplified
 *  Chinese, so the system picks its Chinese fonts, not the Japanese ones). index.html's boot script has the same (T). */
export const htmlLang = (l: Lang) => (l === "pt" ? "pt-BR" : l === "zh" ? "zh-CN" : l);

/** The best of the app's languages for the browser's list (navigator.languages): the first one the app has, by its
 *  main part ("pt-PT" → Portuguese, "zh-TW" → Chinese (Simplified)); the old codes iw (Hebrew) and in (Indonesian) too.
 *  English when none is. */
export function bestLang(prefs: readonly string[]): Lang {
  for (const p of prefs) {
    const c = (p || "").toLowerCase().split(/[-_]/)[0]!;
    const m = c === "iw" ? "he" : c === "in" ? "id" : c;
    if (isLang(m)) return m;
  }
  return "en";
}
