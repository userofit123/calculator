import { describe, expect, it } from "vitest";
import { evaluate, formatDisplay, fractionNote, fractionText, parseStored, sanitizeInput, type EvalOptions } from "../src";
import { q } from "../src/rational";

const v = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "value" in r ? r.value : "error: " + r.error; };
const cases = (list: [string, string, EvalOptions?][]) => list.forEach(([e, want, o]) => it(`${e} → ${want} (${o?.format})`, () => expect(v(e, o)).toBe(want)));
const F: EvalOptions = { format: "fraction" }, M: EvalOptions = { format: "mixed" };

describe("fraction format", () => cases([
  ["3/4", "3/4", F],
  ["1/2 + 1/4", "3/4", F],
  ["7/4", "7/4", F],
  ["-7/4", "-7/4", F],
  ["0.75", "3/4", F],
  ["0.1 + 0.2", "3/10", F],
  ["2/4", "1/2", F],
  ["1/3 × 3", "1", F],
  ["8", "8", F],
  ["0", "0", F],
  ["-5", "-5", F],
  ["1.125", "9/8", F],
  ["1/999999", "1/999999", F],
  ["1/1000000", "1/1000000", F],
  ["2^-3", "1/8", F],
  ["10/4 + 1/6", "8/3", F],
]));

describe("mixed format", () => cases([
  ["7/4", "1 3/4", M],
  ["-7/4", "-1 3/4", M],
  ["3/4", "3/4", M],
  ["-3/4", "-3/4", M],
  ["1.5", "1 1/2", M],
  ["22/7", "3 1/7", M],
  ["12", "12", M],
  ["100 + 1/3", "100 1/3", M],
]));

describe("fractions fall back to decimals", () => cases([
  ["1/1000001", "9.99999000001×10⁻⁷", F],
  ["1/3000000", "3.333333333333×10⁻⁷", { format: "fraction", decimals: 12 }],
  ["√2", "1.414213562373", F],
  ["π", "3.1416", { format: "mixed", decimals: 4 }],
  ["sin(30)", "1/2", F], // exact in degrees
  ["e", "2.718281828459", F],
  ["2^0.5 × 2^0.5", "2", F],
  ["10^20 + 1/3", "100000000000000000000.333333333333", F],
  ["1/7", "0.142857142857", {}],
  ["1/7", "1.43×10⁻¹", { format: "sci", decimals: 2 }],
]));

describe("fractionText", () => {
  it("is null for whole numbers", () => expect(fractionText(q(4n), false)).toBeNull());
  it("respects the denominator limit", () => {
    expect(fractionText(q(1n, 1024n), false, 1000n)).toBeNull();
    expect(fractionText(q(1n, 1000n), false, 1000n)).toBe("1/1000");
  });
  it("mixed with a negative value keeps one minus", () => expect(fractionText(q(-11n, 3n), true)).toBe("-3 2/3"));
  it("large whole parts aren't fractions", () => expect(fractionText(q(10n ** 16n * 3n + 1n, 3n), true)).toBeNull());
});

describe("fractionNote", () => {
  it("is empty outside fraction formats", () => expect(fractionNote(parseStored("≈1.4142"), "auto")).toBe(""));
  it("is empty for a shown fraction", () => expect(fractionNote(parseStored("7/4"), "fraction")).toBe(""));
  it("is empty for a whole number", () => expect(fractionNote(parseStored("12"), "mixed")).toBe(""));
  it("says an approximation is not exact", () => expect(fractionNote(parseStored("≈1.4142135623730951"), "fraction")).toMatch(/Not exact/));
  it("says a denominator is too large", () => expect(fractionNote(parseStored("1/1000001"), "mixed")).toMatch(/Denominator/));
  it("says a whole part is too large", () => expect(fractionNote(parseStored(`${10n ** 20n * 3n + 1n}/3`), "fraction")).toMatch(/Too large/));
});

describe("display and paste", () => {
  it("groups a fraction's digits", () => expect(formatDisplay("1234567/8", { thousands: true })).toBe("1,234,567/8"));
  it("groups with a comma mark", () => expect(formatDisplay("1234 1/2", { thousands: true, decimalMark: "," })).toBe("1.234 1/2"));
  it("pastes a mixed number as whole plus fraction", () => expect(sanitizeInput("1 3/4")).toBe("(1+3÷4)"));
  it("pastes a negative mixed number", () => expect(sanitizeInput("-1 3/4")).toBe("−(1+3÷4)"));
  it("a pasted mixed number works out", () => expect(v(sanitizeInput("-2 1/3"), F)).toBe("-7/3"));
  it("a grouped number with a fraction isn't a mixed number", () => expect(sanitizeInput("1 234/2")).toBe("1234÷2"));
  it("a space-grouped number over something is not a mixed number", () => {
    expect(v(sanitizeInput("10 000/12"), F)).toBe("2500/3");
    expect(sanitizeInput("10 000/12")).toBe("10000÷12");
    expect(sanitizeInput("25 000/365")).toBe("25000÷365");
    expect(sanitizeInput("1 234/567")).toBe("1234÷567"); // 234/567 reduces (gcd 9), so it can't be a displayed fraction
  });
  it("mixed numbers need a reduced proper fraction", () => {
    expect(v(sanitizeInput("1 3/4"), F)).toBe("7/4");
    expect(v(sanitizeInput("2 1/2"), F)).toBe("5/2");
    expect(v(sanitizeInput("-1 3/4"), F)).toBe("-7/4");
    expect(sanitizeInput("1 2/4")).toBe("1 2÷4"); // 2/4 isn't in lowest terms: not mixed, no 3-digit group, so left as typed (1 × 2/4)
  });
  it("a pasted fraction is a division", () => expect(v(sanitizeInput("7/4"), M)).toBe("1 3/4"));
});
