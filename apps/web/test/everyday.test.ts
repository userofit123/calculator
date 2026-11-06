// Everyday mode is optional (Settings → Calculator → Everyday helpers). Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
// a saved Everyday mode from when it was switched on, the switch now off
vi.hoisted(() => {
  const m = new Map<string, string>([["calcMode", JSON.stringify("everyday")], ["calcSettings", JSON.stringify({ everyday: false })]]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { calc, settings, formMode, MODES } from "../src/core/calc";

describe("Everyday mode", () => {
  it("is off by default and a saved Everyday mode falls back to Basic", () => {
    expect(settings.everyday).toBe(false);
    expect(calc.mode).toBe("basic");
  });
  it("switching it off while in it goes back to Basic", async () => {
    settings.everyday = true; await nextTick();
    calc.mode = "everyday"; await nextTick();
    expect(calc.mode).toBe("everyday");
    settings.everyday = false; await nextTick();
    expect(calc.mode).toBe("basic");
  });
  it("has forms, not keys, like Date", () => { expect(formMode("everyday")).toBe(true); expect(formMode("date")).toBe(true); expect(formMode("basic")).toBe(false); });
});

describe("Tip mode", () => {
  it("is always listed, after Date and before Everyday, with forms like Date", () => {
    const ids = MODES.map((m) => m.id);
    expect(ids.indexOf("tip")).toBe(ids.indexOf("date") + 1);
    expect(ids.indexOf("everyday")).toBe(ids.indexOf("tip") + 1);
    expect(formMode("tip")).toBe(true);
  });
  it("stays chosen with the Everyday helpers switched off", async () => {
    settings.everyday = false; calc.mode = "tip"; await nextTick();
    expect(calc.mode).toBe("tip");
    calc.mode = "basic"; await nextTick();
  });
});
