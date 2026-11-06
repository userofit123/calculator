import { describe, expect, it, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { EN_ALL as EN } from "../src/i18n/en-all";
import type { Key } from "../src/i18n/en";
import { HE } from "../src/i18n/he";
import { t, iso, setLang, lang, resolveLang, plural, describeYMD, describeDuration, describeWeeks, rtl, lower, applyLang } from "../src/core/i18n";
import { LANGS } from "../src/i18n/langs";
import { tMsg, knownMsg } from "../src/core/msg";
import { speak } from "../src/core/speak";

const keys = Object.keys(EN) as Key[];
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the dictionaries", () => {
  it("has every English key in Hebrew, and nothing else", () => {
    const missing = keys.filter((k) => typeof HE[k] !== "string" || !HE[k].trim());
    expect(missing).toEqual([]);
    expect(Object.keys(HE).filter((k) => !(k in EN))).toEqual([]);
  });
  it("keeps the same {placeholders} in both languages", () => {
    expect(keys.filter((k) => holes(EN[k]).join() !== holes(HE[k]).join())).toEqual([]);
  });
  it("uses plain dashes only", () => {
    expect(keys.filter((k) => /[–—]/.test(EN[k]) || /[–—]/.test(HE[k]))).toEqual([]);
  });
});

describe("t()", () => {
  afterAll(() => setLang("en"));
  it("fills params and falls back to the key's English", async () => {
    await setLang("en");
    expect(t("upd.available", { v: "1.2.0" })).toBe("Version 1.2.0 is available");
    expect(t("calc.notInMode", { mode: "Basic" })).toBe("Not available in Basic mode");
    expect(t("nav.calc")).toBe("Calculator");
    expect(iso("12")).toBe("12");
  });
  it("switches to Hebrew without a reload, and isolates numbers in Hebrew sentences", async () => {
    await setLang("he");
    expect(lang.value).toBe("he");
    expect(t("nav.calc")).toBe("מחשבון");
    expect(t("upd.available", { v: "1.2.0" })).toBe("גרסה ⁦1.2.0⁩ זמינה");
    expect(t("calc.notInMode", { mode: "מתכנת" })).toBe("לא זמין במצב מתכנת"); // words aren't isolated
    // maths inside a Hebrew text stays in its own order
    expect(t("fmtHint.sci")).toBe("מדעי: \u20661.2345×10³\u2069");
    expect(t("msg.amountFirst")).toBe("קודם הקלידו כמות ויחידה: \u20665 km in mi\u2069");
    // a value with Hebrew letters of its own (a Hebrew date, a filled-in text, a Hebrew search) is not isolated
    expect(iso("6 בנוב׳ 2026")).toBe("6 בנוב׳ 2026");
    expect(t("set.ratesOf", { date: "6 בנוב׳ 2026" })).toBe("שערים מתאריך 6 בנוב׳ 2026");
    expect(t("set.formatHint", { hint: t("fmtHint.sci") })).not.toMatch(/\u2066[^\u2069]*\u2066/);
    expect(t("hist.noMatchesText", { q: "שלום 5" })).toBe("שום דבר בהיסטוריה לא תואם ל-\"שלום 5\".");
    expect(t("hist.noMatchesText", { q: "2+3" })).toBe("שום דבר בהיסטוריה לא תואם ל-\"\u20662+3\u2069\".");
    // "%" goes inside the number's isolate, else it shows first ("%50")
    expect(t("set.pct", { p: 50 })).toBe("\u206650%\u2069");
    expect(t("msg.downloadingPct", { p: 7 })).toBe("מוריד \u20667%\u2069");
    // a leading minus belongs to the number; a hyphen joined to a Hebrew word does not
    expect(t("msg.rateAbove")).toBe("הריבית צריכה להיות מעל \u2066-1\u2069 (\u2066-100%\u2069)");
    expect(t("msg.marginBelow")).toBe("שיעור הרווח צריך להיות מתחת ל-\u20661\u2069 (\u2066100%\u2069)");
    await setLang("en");
    expect(t("nav.calc")).toBe("Calculator");
  });
  it("resolves Auto from the browser's language", () => {
    expect(resolveLang("auto", "he-IL")).toBe("he");
    expect(resolveLang("auto", "iw")).toBe("he");
    expect(resolveLang("auto", "en-GB")).toBe("en");
    expect(resolveLang("en", "he-IL")).toBe("en");
    expect(resolveLang("he", "en-US")).toBe("he");    // the first of the browser's languages the app has, by its main part
    expect(resolveLang("auto", ["ca-ES", "es-ES", "en"])).toBe("es");
    expect(resolveLang("auto", ["pt-PT"])).toBe("pt");
    expect(resolveLang("auto", ["zh-Hans-CN"])).toBe("zh");
    expect(resolveLang("auto", ["in-ID"])).toBe("id");
    expect(resolveLang("auto", ["sw", "xx"])).toBe("en");
    expect(resolveLang("ar", ["de"])).toBe("ar");
    expect(resolveLang("klingon", ["de-AT"])).toBe("de");
  });
});

describe("Hebrew words", () => {
  afterAll(() => setLang("en"));
  it("counts with the forms for one and two", async () => {
    await setLang("en");
    expect(plural(1, "day")).toBe("1 day");
    expect(describeYMD({ years: 2, months: 0, days: 3 })).toBe("2 years, 3 days");
    expect(describeDuration(-3720)).toBe("minus 1 hour, 2 minutes");
    await setLang("he");
    expect(plural(1, "day")).toBe("יום אחד");
    expect(plural(2, "year")).toBe("שנתיים");
    expect(plural(5, "week")).toBe("⁦5⁩ שבועות");
    expect(describeYMD({ years: 1, months: 2, days: 0 })).toBe("שנה אחת, חודשיים");
  });
  it("speaks the operators in Hebrew, function names as typed", async () => {
    await setLang("he");
    expect(speak("2 × 3")).toBe("2 כפול 3");
    expect(speak("3 × −2")).toBe("3 כפול מינוס 2");
    expect(speak("2×10^−3")).toBe("2 כפול עשר בחזקת מינוס 3");
    expect(speak("5² − 3")).toBe("5 בריבוע פחות 3");
    expect(speak("(2) − 3")).toBe("פותח סוגריים 2 סוגר סוגריים פחות 3");
    expect(speak("sin(30)")).toBe("sin פותח סוגריים 30 סוגר סוגריים");
    await setLang("en");
    expect(speak("3 × −2")).toBe("3 times negative 2");
  });
  it("shows the core's English messages in Hebrew", async () => {
    const core = ["Division by zero", "Malformed expression", "Unknown variable x", "Can't convert km to kg", "x is not a binary number",
      "Cost must be above 0", "Pmt takes 3 numbers: Rate; Term; Pv", "Version 1.4.0 is available", "Couldn't reach the ECB or the National Bank of Ukraine"];
    for (const m of core) expect(knownMsg(m), m).toBe(true);
    await setLang("he");
    expect(tMsg("Division by zero")).toBe("חילוק באפס");
    expect(tMsg("Unknown variable x")).toBe("משתנה לא מוכר: ⁦x⁩");
    expect(tMsg("Cost must be above 0")).toBe("העלות: יש להזין ערך מעל \u20660\u2069");
    expect(tMsg("Couldn't reach the ECB or the National Bank of Ukraine")).toBe("אין גישה אל הבנק המרכזי האירופי או הבנק הלאומי של אוקראינה");
    expect(tMsg("Something new")).toBe("Something new");
    await setLang("en");
    expect(tMsg("Division by zero")).toBe("Division by zero");
  });
});

describe("other languages", () => {
  afterAll(() => setLang("en"));
  it("counts by each language's plural rules", async () => {
    await setLang("ru");
    expect(rtl.value).toBe(false);
    expect([1, 2, 5, 21, 0].map((n) => plural(n, "day"))).toEqual(["1 день", "2 дня", "5 дней", "21 день", "0 дней"]);
    expect(plural(-3, "year")).toBe("-3 года");
    await setLang("pl");
    expect([1, 3, 5, 22].map((n) => plural(n, "month"))).toEqual(["1 miesiąc", "3 miesiące", "5 miesięcy", "22 miesiące"]);
    await setLang("ja");
    expect(describeYMD({ years: 2, months: 3, days: 0 })).toBe("2年3か月");
    expect(describeWeeks(10)).toBe("1週間3日");
    await setLang("de");
    expect(describeDuration(-3720)).toBe("minus 1 Stunde, 2 Minuten");
    expect(lower("Trinkgeld")).toBe("Trinkgeld"); // German nouns keep their capital
    await setLang("tr");
    expect(lower("İndirim")).toBe("indirim"); // Turkish rules for the dotted I
    await setLang("ar");
    expect(lang.value).toBe("ar");
    expect(rtl.value).toBe(true);
    const root = { lang: "", dir: "" } as HTMLElement;
    applyLang("ar", root);
    expect(root).toMatchObject({ lang: "ar", dir: "rtl" });
    expect([1, 2, 3, 11, 100].map((n) => plural(n, "day"))).toEqual(["يوم واحد", "يومان", "\u20663\u2069 أيام", "\u206611\u2069 يومًا", "\u2066100\u2069 يوم"]);
    // numbers in an Arabic sentence stay Latin digits, isolated left to right
    expect(t("upd.available", { v: "1.2.0" })).toContain("\u20661.2.0\u2069");
    await setLang("zh");
    applyLang("zh", root);
    expect(root).toMatchObject({ lang: "zh-CN", dir: "ltr" });
    expect(iso("12")).toBe("12");
  });
});

describe("before the first paint", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const boot = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).find((s) => s.includes("calcLang"))!;
  const run = (saved: string | null, browser: string) => {
    const root = { lang: "en", dir: "", style: { setProperty() {} }, dataset: {}, classList: { toggle() {} } };
    const document = { documentElement: root, querySelector: () => ({ setAttribute() {} }) };
    const localStorage = { getItem: (k: string) => (k === "calcLang" ? saved : null) };
    new Function("document", "localStorage", "navigator", "innerWidth", "matchMedia", boot)(document, localStorage, { language: browser }, 1280, () => ({ matches: false }));
    return root;
  };
  it("is an inline script in <head>, before the app's module", () => {
    expect(boot).toBeTruthy();
    expect(html.indexOf("calcLang")).toBeLessThan(html.indexOf('type="module"'));
  });
  it("sets lang and dir from the saved choice or the browser", () => {
    expect(run("he", "en-US")).toMatchObject({ lang: "he", dir: "rtl" });
    expect(run(null, "he-IL")).toMatchObject({ lang: "he", dir: "rtl" });
    expect(run("auto", "he")).toMatchObject({ dir: "rtl" });
    expect(run("en", "he-IL").dir).toBe("");
    expect(run(null, "en-GB").dir).toBe("");    expect(run("ar", "en-US")).toMatchObject({ lang: "ar", dir: "rtl" });
    expect(run(null, "ar-EG")).toMatchObject({ lang: "ar", dir: "rtl" });
    expect(run(null, "zh-TW")).toMatchObject({ lang: "zh-CN", dir: "" });
    expect(run("pt", "en")).toMatchObject({ lang: "pt-BR", dir: "" });
    expect(run(null, "fr-CA")).toMatchObject({ lang: "fr", dir: "" });
    expect(run(null, "sw")).toMatchObject({ lang: "en", dir: "" });
  });
  it("knows the same languages, and the same right-to-left ones, as i18n/langs.ts", () => {
    const codes = /var C="([^"]+)"/.exec(boot)![1]!.split(" ").sort();
    expect(codes).toEqual(LANGS.map((l) => l.code).sort());
    for (const l of LANGS) expect(run(l.code, "en").dir, l.code).toBe(l.rtl ? "rtl" : "");
  });
  it("mounts the app only once the saved language's texts are here", () => {
    const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    expect(main).toMatch(/Promise\.race\(\[i18nReady, stalled\]\)\.then\(\(\) => \{\s*createApp\(App\)\.mount/);
  });
});
