// Every language but English is complete: every English key, the same {placeholders}, plain dashes, a name for every unit
// of @calc/core, a counted form for every plural category of the language, and Latin digits only. Run with the core's
// vitest (one language: add -t "fr:"):
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test langs
import { describe, it, expect } from "vitest";
import { UNIT_CATEGORIES } from "@calc/core";
import { EN_ALL as EN } from "../src/i18n/en-all";
import type { Key } from "../src/i18n/en";
import { LANGS, LOADERS, type LangPack, type Unit } from "../src/i18n/langs";

const keys = Object.keys(EN) as Key[];
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const unitIds = new Set(UNIT_CATEGORIES.flatMap((c) => c.units.map((u) => u.id)));
const UNITS: Unit[] = ["year", "month", "week", "day", "hour", "minute", "second"];
// digits other than 0-9: Arabic-Indic, Persian, Devanagari, Bengali, full-width (numbers stay Latin in every language)
const OTHER_DIGITS = /[٠-٩۰-۹०-९০-৯０-９]/;

for (const info of LANGS) {
  if (info.code === "en") continue;
  const c = info.code;
  describe(`${c}:`, () => {
    let pack: LangPack;
    const load = async () => (pack ??= (await LOADERS[c]()).default);
    it(`${c}: has every English key and nothing else`, async () => {
      const { dict } = await load();
      expect(keys.filter((k) => typeof dict[k] !== "string" || !dict[k].trim())).toEqual([]);
      expect(Object.keys(dict).filter((k) => !(k in EN))).toEqual([]);
    });
    it(`${c}: keeps the same {placeholders}`, async () => {
      const { dict } = await load();
      expect(keys.filter((k) => holes(EN[k]) !== holes(dict[k] ?? ""))).toEqual([]);
    });
    it(`${c}: uses plain dashes and Latin digits only`, async () => {
      const { dict, units } = await load();
      const all = [...Object.entries(dict), ...Object.entries(units)];
      expect(all.filter(([, s]) => /[–—]/.test(s) || OTHER_DIGITS.test(s)).map(([k]) => k)).toEqual([]);
    });
    it(`${c}: names every unit of @calc/core, and no other`, async () => {
      const { units } = await load();
      expect([...unitIds].filter((id) => !units[id]?.trim())).toEqual([]);
      expect(Object.keys(units).filter((id) => !unitIds.has(id))).toEqual([]);
    });
    it(`${c}: has a counted form for every plural category`, async () => {
      const { count } = await load();
      const cats = new Intl.PluralRules(info.locale).resolvedOptions().pluralCategories;
      for (const u of UNITS) {
        const f = count[u] as Record<string, string | undefined>;
        expect(cats.filter((k) => !f?.[k]), `${c} ${u}`).toEqual([]);
        // "other" is used for any number, so it shows the number
        expect(f.other, `${c} ${u}`).toContain("{n}");
      }
    });
  });
}
