// Unit conversions typed into the calculator (calc.ts + unitCalc.ts): the code and the rates load on first use, the
// answer shows its unit, copying and ans take the number alone, history keeps the unit. Run with the core's vitest:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  // rates.ts listens for the device coming back online
  (globalThis as { addEventListener?: unknown }).addEventListener ??= () => {};
});
import { calc, press, preview, current, linePreview, enterLine, withUnit } from "../src/core/calc";
import { history } from "../src/core/history";
import { units, loadUnits, loadRates } from "../src/core/unitCalc";

const type = (s: string) => { for (const k of s) press(k === "-" ? "−" : k); };
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5)); };
beforeEach(() => { press("AC"); calc.ans = ""; calc.mode = "advanced"; });

describe("loading on first use", () => {
  it("= waits for the conversion code, then answers", async () => {
    expect(units.convert).toBeNull();
    type("5km"); press(" "); type("in"); press(" "); type("mi");
    expect(calc.expr).toBe("5km in mi");
    press("=");
    expect(calc.answer).toBe(""); // still loading
    await settle();
    expect(calc.answer).toBe("3.1068559612");
    expect(calc.unit).toBe("mi");
  });
  it("currency loads the rates", async () => {
    await loadUnits();
    type("20"); press(" "); type("USD"); press(" "); type("in"); press(" "); type("EUR");
    expect(calc.expr).toBe("20USD in EUR"); // (the space after a digit isn't typed: 2 3 stays 23)
    press("=");
    await settle();
    expect(units.rates).not.toBeNull();
    expect(calc.unit).toBe("EUR");
    expect(calc.note).toMatch(/European Central Bank reference rates, \d+ \w{3} \d{4}/);
    expect(Number(calc.answer)).toBeGreaterThan(0);
  });
});

describe("the answer and its unit", () => {
  beforeEach(async () => { await loadUnits(); await loadRates(); });
  it("preview shows the unit", () => { calc.expr = "5 mi in km"; expect(preview()).toBe("8.04672 km"); });
  it("copy takes the number alone", () => { calc.expr = "5 mi in km"; press("="); expect(current()?.value).toBe("8.04672"); expect(calc.ans).toBe("25146/3125"); });
  it("ans is the number: ans × 2", () => { calc.expr = "5 mi in km"; press("="); press("×"); type("2="); expect(calc.answer).toBe("16.09344"); expect(calc.unit).toBe(""); });
  it("history keeps the unit", () => {
    calc.expr = "100 degF in degC"; press("=");
    expect(history[0]).toMatchObject({ e: "100 degF in degC", r: "37.7777777778 °C", u: "°C" });
  });
  it("an error stays an error", () => { calc.expr = "5 km in kg"; press("="); expect(calc.error).toBe("Can't convert kilometers to kilograms"); });
  it("withUnit", () => { expect(withUnit("1", "")).toBe("1"); expect(withUnit("1", "mi")).toBe("1 mi"); });
  it("Basic mode too", () => { calc.mode = "basic"; calc.expr = "1 ft in in"; press("="); expect(withUnit(calc.answer, calc.unit)).toBe("12 in"); });
});

describe("Keyboard mode's line", () => {
  beforeEach(async () => { await loadUnits(); await loadRates(); calc.mode = "keyboard"; });
  it("preview and Enter", () => {
    expect(linePreview("5 km in m")).toBe("5000 m");
    expect(enterLine("100 °F in °C")).toBe("");
    expect(calc.unit).toBe("°C");
    expect(history[0]?.r).toBe("37.7777777778 °C");
  });
  it("speed with a slash", () => expect(linePreview("36 km/h in m/s")).toBe("10 m/s"));
});

describe("Programming and back keeps the answer's unit (C-42)", () => {
  beforeEach(async () => { await loadUnits(); await loadRates(); });
  it("the unit survives the round trip", () => {
    calc.mode = "advanced"; press("AC");
    calc.expr = "5 km in mi"; press("=");
    expect(calc.unit).toBe("mi");
    const a = calc.answer;
    calc.mode = "programming";
    calc.mode = "advanced";
    expect(calc.answer).toBe(a);
    expect(calc.unit).toBe("mi");
  });
});
