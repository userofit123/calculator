// The calculator's key handling (apps/web/src/core/calc.ts). The web app has no test runner of its own; run with the
// core's:  ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, beforeEach, vi } from "vitest";
// node has no localStorage: a plain one, in place before calc.ts reads its saved state
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { calc, press, keyFor, preview, typedValue } from "../src/core/calc";
import { history } from "../src/core/history";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => { const p = keyFor({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods } as KeyboardEvent); if (p) press(p); return p; };
const type = (keys: string) => { for (const k of keys) key(k); };
beforeEach(() => { press("AC"); calc.ans = ""; calc.mem = ""; });

describe("scientific entry from the keyboard", () => {
  it("1e5 is 100000", () => {
    type("1e5");
    expect(calc.expr).toBe("1e5");
    expect(preview()).toBe("100000");
    type("=");
    expect(calc.answer).toBe("100000");
  });
  it("2.5e-3 is 0.0025", () => { type("2.5e-3="); expect(calc.answer).toBe("0.0025"); });
  it("Ctrl+E is the ×10ʸ key", () => {
    type("3"); expect(key("e", { ctrlKey: true })).toBe("op:×10^"); type("4=");
    expect(calc.answer).toBe("30000");
  });
  it("other Ctrl shortcuts are left to the browser", () => expect(key("c", { ctrlKey: true })).toBe(""));
});

describe("the on-screen e key", () => {
  it("after a number multiplies: 2 e − 3 is 2×e−3", () => {
    type("2"); press("fn:e"); type("-3");
    expect(calc.expr).toBe("2×e−3");
    type("="); expect(calc.answer).toBe("2.4365636569");
  });
  it("a digit after it multiplies too: e 5 is e×5", () => {
    press("fn:e"); type("5");
    expect(calc.expr).toBe("e×5");
  });
});

describe("long answers", () => {
  it("are stored rounded and marked approximate, not dropped", async () => {
    type("2^9000=");
    expect(calc.ans.length).toBeGreaterThan(2000);
    await nextTick(); // the watchers save it
    expect(JSON.parse(localStorage.getItem("calcAns")!)).toMatch(/^≈1\.\d{29}e2709$/);
    expect(history[0]!.x).toMatch(/^≈1\.\d{29}e2709$/);
  });
  it("approximate answers go into memory and back", () => {
    type("2*"); press("fn:√"); type("(2*10^1000)=");
    press("M+"); press("M+");
    expect(calc.mem).toMatch(/^≈5\.6568542494923801952067548968\de500$/);
    press("AC"); press("MR");
    expect(typedValue(calc.mem)).toBe(calc.expr);
    type("="); expect(calc.answer).toBe("5.6568542495×10⁵⁰⁰");
  });
});
