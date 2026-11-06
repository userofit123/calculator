// Financial mode's forms (apps/web/src/core/calc.ts: fieldText, workOut, enterCall). Run with the core's vitest, see calc.test.ts.
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { calc, press, enterCall, fieldText, workOut, settings } from "../src/core/calc";
import { history } from "../src/core/history";

beforeEach(() => { calc.mode = "financial"; press("AC"); calc.ans = ""; settings.decimalMark = "."; settings.decimals = 2; });
afterAll(() => { calc.mode = "basic"; settings.decimals = 10; });

describe("Financial forms", () => {
  it("Calculate shows the call and its answer and records it in history", () => {
    expect(enterCall(`Pmt(${["200000", "0.05/12", "360"].map(fieldText).join("; ")})`)).toBe("");
    expect(calc.expr).toBe("Pmt(200000; 0.05÷12; 360)");
    expect(calc.answer).toBe("1073.64");
    expect(history[0]!.e).toBe("Pmt(200000; 0.05÷12; 360)");
    expect(history[0]!.r).toBe("1073.64");
  });
  it("the answer carries on like any other", () => {
    enterCall("Sln(1000; 100; 3)");
    press("×"); press("3"); press("=");
    expect(calc.answer).toBe("900");
  });
  it("a sum waiting for a number takes the call in", () => {
    press("2"); press("×");
    expect(enterCall("Sln(1000; 100; 3)")).toBe("");
    expect(calc.expr).toBe("2×Sln(1000; 100; 3)");
    expect(calc.answer).toBe("");
  });
  it("an error is returned and the display left alone", () => {
    press("7");
    expect(enterCall("Gpm(100; 1)")).toBe("Margin must be below 1 (100%)");
    expect(calc.expr).toBe("7");
  });
  it("fields take sums, ans and the user's decimal mark", () => {
    const r = workOut("0.05/12"); expect("value" in r && r.value).toBe("0.004167"); // at least 6 decimals, whatever the setting
    calc.ans = "1000"; const a = workOut("ans/4"); expect("value" in a && a.value).toBe("250");
    expect(workOut("0,05/12")).toMatchObject({ error: expect.any(String) }); // "," separates with a "." mark
    settings.decimalMark = ",";
    expect(fieldText("0,05")).toBe("0.05");
    const s = workOut("0,05÷12"); expect("value" in s && s.value).toBe("0.004167");
  });
});
