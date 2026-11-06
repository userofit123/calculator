// Every unit and category of @calc/core has a Hebrew name: a unit added to core without one would show in English
// in the Hebrew converter. Run with the core's vitest:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test units-he
import { describe, it, expect } from "vitest";
import { UNIT_CATEGORIES } from "@calc/core";
import { HE_UNITS } from "../src/i18n/he/units";
import { EN_ALL as EN } from "../src/i18n/en-all";
import { HE } from "../src/i18n/he";

describe("Hebrew unit names", () => {
  it("names every unit of every category", () => {
    const missing = UNIT_CATEGORIES.flatMap((c) => c.units.filter((u) => !HE_UNITS[u.id]?.trim()).map((u) => `${c.id}/${u.id}`));
    expect(missing).toEqual([]);
  });
  it("has no names for units core doesn't have", () => {
    const ids = new Set(UNIT_CATEGORIES.flatMap((c) => c.units.map((u) => u.id)));
    expect(Object.keys(HE_UNITS).filter((id) => !ids.has(id))).toEqual([]);
  });
  it("uses plain dashes only", () => {
    expect(Object.values(HE_UNITS).filter((s) => /[–—]/.test(s))).toEqual([]);
  });
});

describe("category names", () => {
  const ids = ["currency", ...UNIT_CATEGORIES.map((c) => c.id)];
  it("has a conv.cat key for every category in English and Hebrew", () => {
    const en = EN as Record<string, string>, he = HE as Record<string, string>;
    expect(ids.filter((id) => !en["conv.cat." + id])).toEqual([]);
    expect(ids.filter((id) => !he["conv.cat." + id])).toEqual([]);
  });
  it("words each category in English as core does", () => {
    const en = EN as Record<string, string>;
    for (const c of UNIT_CATEGORIES) expect(en["conv.cat." + c.id]).toBe(c.name);
  });
});
