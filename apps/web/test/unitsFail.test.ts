// A unit chunk that fails to load is reported, not silently ignored (run with the core's vitest, see units.test.ts)
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  (globalThis as { addEventListener?: unknown }).addEventListener ??= () => {};
});
vi.mock("../src/core/unitConv", () => { throw new Error("chunk failed"); });
import { calc, press, enterLine, UNITS_FAILED } from "../src/core/calc";
import { toasts } from "../src/core/toast";

const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 5)); };
describe("unit tables fail to load", () => {
  it("Enter's promise rejects", async () => {
    calc.mode = "keyboard";
    const r = enterLine("5 km in mi");
    expect(typeof r).not.toBe("string");
    await expect(r).rejects.toBeTruthy();
    expect(UNITS_FAILED).toBe("Couldn't load the unit tables");
  });
  it("= says so with a toast", async () => {
    calc.mode = "advanced"; press("AC");
    for (const k of "5km in mi") press(k);
    press("=");
    await settle();
    expect(JSON.stringify(toasts)).toContain(UNITS_FAILED);
    expect(calc.answer).toBe("");
  });
});
