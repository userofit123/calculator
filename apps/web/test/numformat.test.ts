// Fraction and mixed number display, the number format chip and decimal places (apps/web/src/core/calc.ts). Run with the
// core's runner:  ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { calc, press, settings, cycleFormat, answerNote, current, enterLine, paste, workOut } from "../src/core/calc";
import { history } from "../src/core/history";

const keys = (s: string) => { for (const k of s.split(" ")) press(k); };
beforeEach(() => { calc.mode = "basic"; press("AC"); calc.ans = ""; settings.format = "auto"; settings.decimals = 10; });

describe("fraction formats on the display", () => {
  it("shows an exact answer as a fraction", () => { settings.format = "fraction"; keys("7 ÷ 4 ="); expect(calc.answer).toBe("7/4"); });
  it("and as a mixed number", () => { settings.format = "mixed"; keys("7 ÷ 4 ="); expect(calc.answer).toBe("1 3/4"); });
  it("re-formats the answer on the display when the format changes", async () => {
    keys("1 ÷ 3 ="); expect(calc.answer).toBe("0.3333333333");
    settings.format = "fraction"; await nextTick(); expect(calc.answer).toBe("1/3");
    settings.format = "auto"; settings.decimals = 3; await nextTick(); expect(calc.answer).toBe("0.333");
  });
  it("the chip steps Decimal, Fraction, Mixed, Sci, Eng and back", () => {
    const seen = [settings.format];
    for (let i = 0; i < 5; i++) { cycleFormat(); seen.push(settings.format); }
    expect(seen).toEqual(["auto", "fraction", "mixed", "sci", "eng", "auto"]);
  });
  it("an operator after a fraction carries on from the whole answer", () => {
    settings.format = "fraction"; keys("7 ÷ 4 ="); keys("op:^ 2 =");
    expect(calc.expr).toBe("ans^2"); expect(calc.answer).toBe("49/16");
  });
  it("history keeps the exact value", () => { settings.format = "mixed"; keys("5 ÷ 2 ="); expect(history[0]?.x).toBe("5/2"); expect(history[0]?.r).toBe("2 1/2"); });
  it("copy takes what is shown", () => { settings.format = "mixed"; keys("5 ÷ 2 ="); expect(current()?.value).toBe("2 1/2"); });
  it("says why an approximation is a decimal", () => {
    settings.format = "fraction"; keys("fn:√ 2 =");
    expect(calc.answer).toBe("1.4142135624"); expect(answerNote(calc.ans)).toMatch(/Not exact/);
    expect(answerNote("7/4")).toBe("");
  });
  it("pasting a mixed number reads it as one", () => { paste("1 3/4"); press("="); expect(calc.ans).toBe("7/4"); });
  it("Keyboard mode answers follow the format", () => {
    settings.format = "mixed"; calc.mode = "keyboard";
    expect(enterLine("10/4")).toBe(""); expect(calc.answer).toBe("2 1/2");
  });
  it("form fields stay decimals", () => { settings.format = "fraction"; const r = workOut("1/4"); expect("value" in r && r.value).toBe("0.25"); });
  it("Programming mode is unaffected", () => {
    settings.format = "fraction"; calc.mode = "programming"; keys("7 ÷ 2 =");
    expect(calc.answer).toBe("3");
  });
});
