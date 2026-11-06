// Everyday mode is always there (C-59: no longer a switch in Settings). Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
// a saved Everyday mode, with the old "everyday: false" switch still in the saved settings
vi.hoisted(() => {
  const m = new Map<string, string>([["calcMode", JSON.stringify("everyday")], ["calcSettings", JSON.stringify({ everyday: false, decimals: 4 })]]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { calc, settings, formMode, MODES } from "../src/core/calc";

describe("Everyday mode", () => {
  it("a saved Everyday mode opens in Everyday, and the old switch is ignored", () => {
    expect(calc.mode).toBe("everyday");
    expect(settings.decimals).toBe(4);
    expect("everyday" in settings).toBe(false);
  });
  it("is always in the mode list", () => { expect(MODES.map((m) => m.id)).toContain("everyday"); });
  it("has forms, not keys, like Date", () => { expect(formMode("everyday")).toBe(true); expect(formMode("date")).toBe(true); expect(formMode("basic")).toBe(false); });
});

describe("Tip mode", () => {
  it("is always listed, after Date and before Everyday, with forms like Date", () => {
    const ids = MODES.map((m) => m.id);
    expect(ids.indexOf("tip")).toBe(ids.indexOf("date") + 1);
    expect(ids.indexOf("everyday")).toBe(ids.indexOf("tip") + 1);
    expect(formMode("tip")).toBe(true);
  });
  it("stays chosen", async () => {
    calc.mode = "tip"; await nextTick();
    expect(calc.mode).toBe("tip");
    calc.mode = "basic"; await nextTick();
  });
});
