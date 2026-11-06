// Everyday mode is optional (Settings → Calculator → Everyday helpers). Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
// a saved Everyday mode from when it was switched on, the switch now off
vi.hoisted(() => {
  const m = new Map<string, string>([["calcMode", JSON.stringify("everyday")], ["calcSettings", JSON.stringify({ everyday: false })]]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { calc, settings, formMode } from "../src/core/calc";

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
