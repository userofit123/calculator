// Programming mode's key handling (apps/web/src/core/calc.ts). Run with the core's vitest, see calc.test.ts.
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { nextTick } from "vue";
import { toggleBit } from "@calc/core";
import { calc, press, keyFor, preview, prog, progValue, setBase, setProgValue, paste, current, restoreExpr } from "../src/core/calc";
import { history } from "../src/core/history";

const key = (k: string) => { const p = keyFor({ key: k, ctrlKey: false, metaKey: false, altKey: false } as KeyboardEvent); if (p) press(p); return p; };
const type = (keys: string) => { for (const k of keys) key(k); };
beforeEach(() => { calc.mode = "programming"; Object.assign(prog, { base: 10, wordSize: 64, signed: false }); press("AC"); calc.ans = ""; });
afterAll(() => { calc.mode = "basic"; });

describe("typing digits", () => {
  it("hex letters type in hex mode", () => {
    prog.base = 16; type("ff+1");
    expect(calc.expr).toBe("FF+1");
    expect(preview()).toBe("100");
  });
  it("letters and digits outside the base do nothing", () => {
    type("a9"); expect(calc.expr).toBe("9"); press("AC");
    prog.base = 2; type("1021"); expect(calc.expr).toBe("101");
    expect(keyFor({ key: "2" } as KeyboardEvent)).toBe("");
  });
  it("the decimal point does nothing", () => { type("1.5"); expect(calc.expr).toBe("15"); });
});

describe("operator keys", () => {
  it("& | ^ ~ < > % type AND OR XOR NOT shifts and mod", () => {
    type("12&10"); expect(calc.expr).toBe("12 AND 10"); press("AC");
    type("12|10"); expect(calc.expr).toBe("12 OR 10"); press("AC");
    type("12^10="); expect(calc.answer).toBe("6"); press("AC");
    type("1<4="); expect(calc.answer).toBe("16"); press("AC");
    type("256>4="); expect(calc.answer).toBe("16"); press("AC");
    type("7%3="); expect(calc.answer).toBe("1"); press("AC");
    prog.wordSize = 8; type("~0="); expect(calc.answer).toBe("255");
  });
  it("^ is still a power in the other modes", () => {
    calc.mode = "basic"; type("2^3="); expect(calc.answer).toBe("8");
  });
  it("a number then NOT multiplies, never one word", () => { type("5"); press("fn:NOT "); expect(calc.expr).toBe("5×NOT "); });
  it("delete takes an operator word as a whole", () => { type("12&"); press("⌫"); expect(calc.expr).toBe("12"); });
  it("the 2nd-layer keys and complements", () => {
    prog.wordSize = 8;
    type("12"); press("op: NAND "); type("10="); expect(calc.answer).toBe("247"); press("AC");
    press("fn:twos("); type("1="); expect(calc.answer).toBe("255");
  });
  it("an operator after an answer carries on from it, in the base", () => {
    prog.base = 16; type("F+1="); key("&"); type("1F=");
    expect(calc.expr).toBe("10 AND 1F"); expect(calc.answer).toBe("10");
  });
});

describe("bases, word size and sign", () => {
  it("the answer follows the base", async () => {
    type("255="); setBase(16); await nextTick(); expect(calc.answer).toBe("FF");
    setBase(2); await nextTick(); expect(calc.answer).toBe("11111111");
  });
  it("a sum being typed keeps its meaning when the base changes", () => { type("10+10"); setBase(16); expect(calc.expr).toBe("A+A"); expect(preview()).toBe("14"); });
  it("an answer too big for a smaller word is an overflow", async () => {
    type("300="); prog.wordSize = 8; await nextTick(); expect(calc.error).toBe("Overflow. Try a bigger word size");
  });
  it("signed: negative answers, shown as their bits in hex", async () => {
    prog.signed = true; prog.wordSize = 8; type("3-5="); expect(calc.answer).toBe("-2");
    setBase(16); await nextTick(); expect(calc.answer).toBe("FE");
  });
  it("unsigned: a negative answer is an error", () => { type("3-5="); expect(calc.error).toMatch(/Signed/); });
});

describe("the bit view", () => {
  it("flipping a bit types the new number", () => {
    prog.wordSize = 8; type("5=");
    setProgValue(toggleBit(progValue()!, 7, prog));
    expect(calc.expr).toBe("133"); expect(progValue()).toBe(133n);
  });
  it("a negative number in decimal goes in brackets", () => {
    Object.assign(prog, { wordSize: 8, signed: true }); setProgValue(toggleBit(0n, 7, prog));
    expect(calc.expr).toBe("(−128)"); expect(preview()).toBe("-128");
  });
});

describe("history", () => {
  it("records the base", () => {
    prog.base = 16; type("FF+1=");
    expect(history[0]).toMatchObject({ e: "FF+1", r: "100", x: "256", b: 16, w: 64, s: false });
  });
  it("brings a sum back with its base, word size and sign", () => {
    Object.assign(prog, { base: 16, wordSize: 8, signed: true }); type("7F+1="); // overflow in 8 bits signed
    expect(calc.error).toMatch(/Overflow/); press("AC");
    Object.assign(prog, { wordSize: 16, signed: false }); type("FF+1=");
    const h = history[0]!;
    expect(h).toMatchObject({ e: "FF+1", b: 16, w: 16, s: false });
    calc.mode = "basic"; Object.assign(prog, { base: 2, wordSize: 8, signed: true });
    restoreExpr(h);
    expect(calc.mode).toBe("programming");
    expect({ ...prog }).toEqual({ base: 16, wordSize: 16, signed: false });
    expect(calc.expr).toBe("FF+1"); press("=");
    expect(calc.answer).toBe("100");
  });
  it("an entry from before word size and sign were kept leaves them as they are", () => {
    Object.assign(prog, { wordSize: 32, signed: true }); calc.mode = "basic";
    restoreExpr({ e: "FF", b: 16 });
    expect({ ...prog }).toEqual({ base: 16, wordSize: 32, signed: true });
  });
});

describe("changing mode", () => {
  it("an answer carried into programming mode is written in its base", () => {
    calc.mode = "basic"; prog.base = 16; type("200+55=");
    calc.mode = "programming";
    expect(calc.expr).toBe("FF"); expect(calc.answer).toBe("");
    expect(progValue()).toBe(255n); expect(current()?.value).toBe("FF");
  });
  it("an answer carried out of programming mode is written in decimal", () => {
    prog.base = 16; type("F0+F=");
    calc.mode = "basic";
    expect(calc.expr).toBe("255"); expect(current()?.value).toBe("255");
    calc.mode = "programming"; press("AC"); Object.assign(prog, { wordSize: 8, signed: true }); type("0-5="); calc.mode = "basic";
    expect(calc.expr).toBe("−5");
  });
  it("an answer with a fraction can't go into programming mode", () => {
    calc.mode = "basic"; type("1/2=");
    calc.mode = "programming";
    expect(calc.expr).toBe(""); expect(calc.answer).toBe(""); expect(progValue()).toBe(0n);
  });
  it("a sum being typed keeps its meaning", () => {
    prog.base = 16; type("FF+1"); calc.mode = "basic";
    expect(calc.expr).toBe("255+1");
    calc.mode = "programming"; expect(calc.expr).toBe("FF+1");
  });
});

describe("paste", () => {
  it("a number with a fraction is the whole-numbers error, not its digits run together", () => {
    paste("3.14"); expect(calc.expr).toBe("3.14");
    press("="); expect(calc.error).toBe("Programming mode works with whole numbers");
  });
  it("thousands separators go", () => { paste("1,000"); expect(calc.expr).toBe("1000"); });
});
