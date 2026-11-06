import { describe, expect, it } from "vitest";
import { evaluate, formatDisplay, sanitizeInput, type EvalOptions } from "../src";

const v = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "value" in r ? r.value : "error: " + r.error; };
const err = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "error" in r ? r.error : "value: " + r.value; };
const cases = (list: [string, string, EvalOptions?][]) => list.forEach(([e, want, o]) => it(`${e} = ${want}`, () => expect(v(e, o)).toBe(want)));

describe("exact arithmetic", () => cases([
  ["0.1 + 0.2", "0.3"],
  ["1/3*3", "1"],
  ["1 ÷ 3", "0.333333333333"],
  ["2 + 3 × 4 − 6 ÷ 4", "12.5"],
  ["-(2 + 3) * -2", "10"],
  ["2^100", "1267650600228229401496703205376"],
  ["2^-2", "0.25"],
  ["0.1 × 3", "0.3"],
  ["1.1 − 2.2", "-1.1"],
  ["123456789 × 987654321", "121932631112635269"],
  ["7 − 10", "-3"],
  [".5 + .25", "0.75"],
]));

describe("precedence and grouping", () => cases([
  ["2 + 3 × 4", "14"],
  ["(2 + 3) × 4", "20"],
  ["2^3^2", "512"],
  ["-2^2", "-4"],
  ["(-2)^2", "4"],
  ["2^-1", "0.5"],
  ["10 − 4 − 3", "3"],
  ["100 ÷ 10 ÷ 5", "2"],
  ["2 × (3 + 4", "14"],
  ["((1 + 2) × (3", "9"],
  ["2 × −3", "-6"],
  ["--3", "3"],
]));

describe("implicit multiplication", () => cases([
  ["3(4)", "12"],
  ["(2)(3)", "6"],
  ["2π", "6.28318530718"],
  ["2sin(30)", "1"],
  ["2 sin 30 + 1", "2"],
  ["4√9", "12"],
  ["2(3)²", "18"],
  ["3x", "15", { variables: { x: "5" } }],
  ["xy", "6", { variables: { x: "2", y: "3" } }],
]));

describe("powers, roots, superscripts", () => cases([
  ["3²", "9"],
  ["2³", "8"],
  ["10⁻²", "0.01"],
  ["2⁻¹", "0.5"],
  ["√16", "4"],
  ["√2", "1.414213562373"],
  ["√2 × √2", "2"],
  ["∛27", "3"],
  ["∛-8", "-2"],
  ["³√8", "2"],
  ["⁴√81", "3"],
  ["root(32; 5)", "2"],
  ["8^(1/3)", "2"],
  ["4^1.5", "8"],
  ["2^0.5", "1.414213562373"],
  ["sqrt(0.25)", "0.5"],
]));

describe("percent (GNOME's semantics)", () => cases([
  ["50%", "0.5"],
  ["200 + 10%", "220"],
  ["200 − 10%", "180"],
  ["200 × 10%", "20"],
  ["200 ÷ 10%", "2000"],
  ["10% × 50", "5"],
]));

describe("factorial and gamma", () => cases([
  ["5!", "120"],
  ["0!", "1"],
  ["3!!", "720"],
  ["20!", "2432902008176640000"],
  ["0.5!", "0.886226925453"],
  ["gamma(5)", "24"],
]));

describe("trigonometry in each angle unit", () => cases([
  ["sin(30)", "0.5"],
  ["cos(90)", "0"],
  ["tan(45)", "1"],
  ["sin 390", "0.5"],
  ["cos(180)", "-1"],
  ["cos 60", "0.5"],
  ["sin(-30)", "-0.5"],
  ["sin(45)", "0.707106781187"],
  ["asin(0.5)", "30"],
  ["acos(0.5)", "60"],
  ["atan(1)", "45"],
  ["sin⁻¹(1)", "90"],
  ["sin(π/6)", "0.5", { angle: "rad" }],
  ["cos(π/2)", "0", { angle: "rad" }],
  ["sin(π)", "0", { angle: "rad" }],
  ["tan(π/4)", "1", { angle: "rad" }],
  ["asin(1)", "1.570796326795", { angle: "rad" }],
  ["sin(100)", "1", { angle: "grad" }],
  ["cos(200)", "-1", { angle: "grad" }],
  ["tan(50)", "1", { angle: "grad" }],
  ["asin(1)", "100", { angle: "grad" }],
  ["sinh(0)", "0"],
  ["cosh(1)", "1.543080634815"],
  ["atanh(0.5)", "0.549306144334"],
  ["sin²(30) + cos²(30)", "1"],
]));

describe("logarithms and exponentials", () => cases([
  ["log(1000)", "3"],
  ["log 0.001", "-3"],
  ["log₂(8)", "3"],
  ["log2(1024)", "10"],
  ["log(8; 2)", "3"],
  ["ln(e)", "1"],
  ["ln(1)", "0"],
  ["e^2", "7.389056098931"],
  ["exp(0)", "1"],
  ["10^3", "1000"],
  ["ln 2", "0.69314718056"],
]));

describe("rounding functions, abs, mod, sgn", () => cases([
  ["floor(2.7)", "2"],
  ["floor(-2.5)", "-3"],
  ["ceil(2.1)", "3"],
  ["round(2.5)", "3"],
  ["round(-2.5)", "-3"],
  ["int(-2.7)", "-2"],
  ["frac(2.75)", "0.75"],
  ["frac(-2.75)", "-0.75"],
  ["sgn(-4)", "-1"],
  ["|-5|", "5"],
  ["|2 − 7| × 2", "10"],
  ["abs(-3.5)", "3.5"],
  ["17 mod 5", "2"],
  ["-7 mod 3", "2"],
  ["floor(log(1000))", "3"],
]));

describe("constants, scientific entry, ans and variables", () => {
  cases([
    ["π", "3.14159265359"],
    ["e", "2.718281828459"],
    ["1.2e5", "120000"],
    ["1.5E-3", "0.0015"],
    ["1.2×10^5", "120000"],
    ["2e", "5.436563656918"],
    ["ans × 2", "2", { ans: "1" }],
    ["ans", "0.5", { ans: "0.5" }],
    ["ans × 3", "1", { ans: "1/3" }],
    ["x + 1", "6", { variables: { x: "5" } }],
  ]);
  it("stores an assignment", () => expect(evaluate("x = 2 + 3")).toEqual({ value: "5", exact: "5", assigned: "x" }));
  it("keeps 1/3 exact for later", () => expect(evaluate("1/3")).toMatchObject({ exact: "1/3" }));
  it("refuses to change a constant", () => expect(err("pi = 3")).toBe("Can't change pi"));
});

describe("formatting", () => {
  cases([
    ["2^200", "1.606938044259×10⁶⁰"],
    ["1/3", "0.33", { decimals: 2 }],
    ["1/7", "0.142857142857"],
    ["0.000000123", "1.23×10⁻⁷"],
    ["1/3", "3.33333×10⁻¹", { format: "sci", decimals: 5 }],
    ["12345", "12.345×10³", { format: "eng" }],
    ["2^70", "1180591620717411303424", { format: "fixed" }],
    ["1e30 × 1.5", "1500000000000000000000000000000"],
    ["0.1 × 3", "0.3"],
    ["1000000 × π", "3141592.65358979"],
    ["2.50", "2.5"],
  ]);
  it("groups thousands and swaps the decimal mark for display", () => {
    expect(formatDisplay("1234567.891", { thousands: true })).toBe("1,234,567.891");
    expect(formatDisplay("1234567.891", { thousands: true, decimalMark: "," })).toBe("1.234.567,891");
    expect(formatDisplay("12+3.5×1000", { decimalMark: "," })).toBe("12+3,5×1000");
  });
  it("cleans pasted text", () => {
    expect(sanitizeInput("1,234.5 * 2")).toBe("1234.5 × 2");
    expect(sanitizeInput("1.234,5 - 2", ",")).toBe("1234.5 − 2");
    expect(sanitizeInput("$12.50 + 3 =")).toBe("12.50 + 3");
  });
});

describe("errors", () => {
  const errs: [string, string][] = [
    ["5 ÷ 0", "Division by zero"],
    ["5 mod 0", "Division by zero"],
    ["5 +", "Malformed expression"],
    ["×5", "Malformed expression"],
    ["2 3", "Malformed expression"],
    ["(2))", "Too many closing brackets"],
    ["foo(2)", "Unknown function foo"],
    ["y + 1", "Unknown variable y"],
    ["√-4", "Root of a negative number"],
    ["ln(0)", "Logarithm of zero or less"],
    ["(-3)!", "Factorial of a negative number"],
    ["tan(90)", "Tangent is undefined here"],
    ["asin(2)", "Out of range for asin"],
    ["0^-1", "Division by zero"],
    ["10^1000000000", "Number is too large"],
    ["", "Malformed expression"],
    ["2 # 3", "Malformed expression"],
  ];
  errs.forEach(([e, want]) => it(`${e || "(empty)"} → ${want}`, () => expect(err(e)).toBe(want)));
});

describe("brackets left open are closed at the end", () => cases([
  ["(2 + 3", "5"],
  ["2 × (3 + (4 − 1", "12"],
  ["sin(30", "0.5"],
  ["-(4", "-4"],
]));

describe("bracket errors", () => {
  it("a closing bracket with none open", () => expect(err(")2")).toBe("Too many closing brackets"));
  it("one too many after a group", () => expect(err("(1 + 2)) × 3")).toBe("Too many closing brackets"));
  it("an empty pair", () => expect(err("()")).toBe("Malformed expression"));
  it("only an opening bracket", () => expect(err("(")).toBe("Malformed expression"));
});

describe("rounding negative results", () => cases([
  ["-2/3", "-0.67", { decimals: 2 }],
  ["-1/3", "-0.33", { decimals: 2 }],
  ["-0.125", "-0.13", { decimals: 2 }],
  ["-2.5", "-3", { decimals: 0 }],
  ["-0.004", "0", { format: "fixed", decimals: 2 }],
  ["-0.006", "-0.01", { format: "fixed", decimals: 2 }],
  ["round(-2.4)", "-2"],
  ["round(-0.5)", "-1"],
]));

describe("numbers written with a leading or trailing point", () => cases([
  [".5", "0.5"],
  ["5.", "5"],
  [".5 × 2", "1"],
  ["5. + .5", "5.5"],
  ["-.5", "-0.5"],
]));

