import { describe, expect, it } from "vitest";
import { evaluate, formatDisplay, sanitizeInput, type EvalOptions } from "../src";
import { gcd } from "../src/rational";

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


describe("big numbers stay fast", () => {
  const timed = (e: string) => { const t = performance.now(); const r = evaluate(e); return { r, ms: performance.now() - t }; };
  it("2^100000 is worked out and shown in under 200 ms", () => {
    const { r, ms } = timed("2^100000");
    expect("value" in r && r.value).toBe("9.990020930144×10³⁰¹⁰²");
    expect(ms).toBeLessThan(200);
  });
  it("1.5^60000 is worked out and shown in under 200 ms", () => {
    const { r, ms } = timed("1.5^60000");
    expect("value" in r && r.value).toMatch(/×10¹⁰⁵⁶⁵$/);
    expect(ms).toBeLessThan(200);
  });
  it("2^1000000 is refused at once", () => {
    const { r, ms } = timed("2^1000000");
    expect(r).toEqual({ error: "Number is too large" });
    expect(ms).toBeLessThan(50);
  });
  it("powers of powers are refused at once too", () => {
    const { r, ms } = timed("9^9^9^9");
    expect(r).toEqual({ error: "Number is too large" });
    expect(ms).toBeLessThan(50);
  });
  it("products past the limit are refused", () => expect(err("2^300000 × 2^300000")).toBe("Number is too large"));
  it("sums of big fractions (a fast gcd) stay exact and quick", () => {
    const { r, ms } = timed("1.5^60000 − 1.5^60000 + 1/3 × 3");
    expect("value" in r && r.value).toBe("1");
    expect(ms).toBeLessThan(500);
  });
  it("a big gcd is right", () => expect(v("(3^5000 × 7) ÷ (3^4999 × 14)")).toBe("1.5"));
});

describe("logarithms and roots of numbers beyond a double", () => cases([
  ["log(10^1000)", "1000"],
  ["log₂(2^2000)", "2000"],
  ["log(10^-500)", "-500"],
  ["ln(10^400)", "921.034037197618"],
  ["√(2×10^1000)", "1.414213562373×10⁵⁰⁰"],
  ["∛(10^999)", "1×10³³³"],
  ["√(10^1001)", "3.162277660168×10⁵⁰⁰"],
  ["(2×10^1000)^0.5", "1.414213562373×10⁵⁰⁰"],
  ["log(2^1000; 4)", "500"],
]));

describe("scientific entry with the calculator's minus sign", () => cases([
  ["1.5e−3", "0.0015"],
  ["2E−2 + 1", "1.02"],
  ["1e+3", "1000"],
  ["2×e−3", "2.436563656918"],
]));

describe("pasted text", () => {
  it("keeps · ⋅ ∕ as multiply and divide", () => {
    expect(sanitizeInput("2·3")).toBe("2×3");
    expect(sanitizeInput("2⋅3")).toBe("2×3");
    expect(sanitizeInput("6∕3")).toBe("6÷3");
    expect(v(sanitizeInput("2·3 + 6∕3"))).toBe("8");
  });
  it("keeps e-notation working after the minus sign is changed", () => expect(v(sanitizeInput("1.5e-3"))).toBe("0.0015"));
});

describe("variables never match built-in object names", () => {
  it("constructor is unknown", () => expect(err("constructor")).toBe("Unknown variable constructor"));
  it("toString is unknown even with variables", () => expect(err("toString", { variables: { x: "1" } })).toBe("Unknown variable toString"));
});

describe("grouping leaves exponents alone", () => {
  it("2^12345", () => expect(formatDisplay("2^12345", { thousands: true })).toBe("2^12345"));
  it("1e12345 + 1234", () => expect(formatDisplay("1e12345+1234", { thousands: true })).toBe("1e12345+1,234"));
  it("12345×10^12345", () => expect(formatDisplay("12345×10^12345", { thousands: true })).toBe("12,345×10^12345"));
  it("the decimal mark still changes", () => expect(formatDisplay("1234.5", { thousands: true, decimalMark: "," })).toBe("1.234,5"));
});

describe("the fast gcd agrees with the textbook one", () => {
  const slow = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a; };
  let seed = 12345n;
  const rnd = (bits: number) => { let x = 0n; for (let i = 0; i < bits; i += 31) { seed = (seed * 1103515245n + 12345n) % 2147483648n; x = (x << 31n) | seed; } return x; };
  it("on 200 pairs of random sizes with shared factors", () => {
    for (let i = 0; i < 200; i++) {
      const g = rnd(1 + (i % 7) * 40), a = rnd(10 + i * 13) * g, b = rnd(5 + ((i * 37) % 2000)) * g;
      expect(gcd(a, b)).toBe(slow(a, b));
      expect(gcd(-a, b)).toBe(slow(a, b));
    }
  });
});

describe("a preview's lower size limit", () => {
  it("refuses big numbers at once instead of working them out", () => {
    const t = performance.now();
    const r = evaluate("3^209000 ÷ 5^140000", { maxBits: 110000 });
    expect(performance.now() - t).toBeLessThan(20);
    expect(r).toEqual({ error: "Too large to work out while typing" });
  });
  it("still says when = would be too large", () => expect(evaluate("2^1000000", { maxBits: 110000 })).toEqual({ error: "Number is too large" }));
  it("works out what fits", () => expect(v("2^100 + 1", { maxBits: 110000 })).toBe("1267650600228229401496703205377"));
  it("is gone again for the next sum", () => { evaluate("1", { maxBits: 10 }); expect(v("2^1000")).toMatch(/×10³⁰¹$/); });
});

describe("roots with a big index stay fast (the preview works them out on every key press)", () => {
  const timed = (e: string, o: EvalOptions = {}) => { const t = performance.now(); const r = evaluate(e, o); return { r, ms: performance.now() - t }; };
  for (const [e, want] of [
    ["root(10^400; 100000)", "1.009252886077"],
    ["root(10^400; 10000)", "1.096478196143"],
    ["root(10^400; 3000)", "1.359356390879"],
    ["(10^400)^(1/999)", "2.514203348143"],
    ["(10^400)^(1/100000)", "1.009252886077"],
    ["root(10^-400; 1000)", "0.398107170553"],
  ] as const) {
    it(`${e} = ${want} in under 50 ms, also as a preview`, () => {
      for (const o of [{}, { maxBits: 110000 }]) {
        const { r, ms } = timed(e, o);
        expect("value" in r && r.value).toBe(want);
        expect(ms).toBeLessThan(50);
      }
    });
  }
  it("a root beyond a double's range with the biggest index that has one", () => {
    const { r, ms } = timed("root(9^100000; 300)");
    expect("value" in r && r.value).toMatch(/×10³¹⁸$/);
    expect(ms).toBeLessThan(200);
  });
});

describe("approximate roots beyond a double are marked approximate, never exact", () => {
  const exactOf = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "exact" in r ? r.exact : "error: " + r.error; };
  it("√(2×10^1000) is stored as an approximation", () => expect(exactOf("√(2×10^1000)")).toBe("≈1.41421356237309504880168872421e500"));
  it("…and reads back as one", () => expect(exactOf("ans", { ans: "≈1.41421356237309504880168872421e500" })).toBe("≈1.41421356237309504880168872421e500"));
  it("no made-up exact digits in fixed format", () => expect(v("√(2×10^1000)", { format: "fixed" })).toBe("1.414213562373×10⁵⁰⁰"));
  it("a difference of nearly equal approximations is not an exact 0", () => {
    expect(exactOf("√(2×10^1000) − 1414213562373095048801688724209×10^470")).not.toBe("0");
    expect(exactOf("√(2×10^1000) − 1414213562373095048801688724209×10^470")).not.toMatch(/^-?\d+$/);
  });
  it("floor of it is approximate too", () => expect(exactOf("floor(√(2×10^1000))")).toMatch(/^≈1\.414213562373095048801688724\d*e500$/));
  it("mod of it can't be known", () => expect(err("floor(√(2×10^1000)) mod 7")).toBe("Not precise enough for mod"));
  it("nor of a double past its digits", () => expect(err("(10^20 × π) mod 7")).toBe("Not precise enough for mod"));
  it("floor of a big double is not exact", () => expect(exactOf("floor(10^20 × π)")).toBe("≈314159265358979000000"));
  it("…but floor of an exact number is", () => expect(exactOf("floor(10^40 + 1/2)")).toBe("1" + "0".repeat(40)));
  it("arithmetic on an approximation stays approximate", () => {
    expect(exactOf("√(2×10^1000) × 2")).toBe("≈2.82842712474619009760337744842e500");
    expect(exactOf("(√(2×10^1000))^2")).toMatch(/^≈2\.0{20,}\d*e1000$/);
    expect(v("√(2×10^1000) ÷ 10^500")).toBe("1.414213562373");
  });
  it("roots of negative numbers beyond a double agree", () => {
    expect(v("(−2×10^1000)^(1/3)")).toBe("-2.714417616595×10³³³");
    expect(v("∛(−2×10^1000)")).toBe("-2.714417616595×10³³³");
    expect(exactOf("(−2×10^1000)^(1/3)")).toBe(exactOf("∛(−2×10^1000)"));
    expect(v("(−2×10^1000)^(2/3)")).toBe("7.368062997281×10⁶⁶⁶");
  });
  it("a power by logarithms beyond a double is approximate", () => {
    expect(exactOf("(10^400)^1.5")).toBe("1" + "0".repeat(600));
    expect(exactOf("(2×10^400)^0.75")).toMatch(/^≈1\.68179283\d*e\+300$/);
  });
});

describe("stored values too long to keep", () => {
  it("are kept rounded and marked approximate", async () => {
    const { storable } = await import("../src/format");
    expect(storable("12")).toBe("12");
    const long = "7".repeat(2500);
    expect(storable(long)).toBe("≈7.77777777777777777777777777778e2499");
    expect(v("ans + 1", { ans: storable(long) })).toBe("7.777777777778×10²⁴⁹⁹");
    expect(storable("1/" + "3".repeat(2500))).toMatch(/^≈3\.0{29}e-2500$/);
  });
});

describe("stored approximations typed back into a sum", () => {
  it("negative ones too", () => expect(v("(≈-1.41421356237309504880168872421e500)+(≈−1.41421356237309504880168872421e500)")).toBe("-2.828427124746×10⁵⁰⁰"));
  it("as memory plus an answer", () => expect(evaluate("(≈2.5)+(1/2)")).toEqual({ value: "3", exact: "≈3" }));
});

describe("every double is stored marked approximate, and reads back as the same double", () => {
  const exactOf = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "exact" in r ? r.exact : "error: " + r.error; };
  it("2^(1÷3)", () => expect(exactOf("2^(1÷3)")).toBe("≈1.2599210498948732"));
  it("…read back", () => expect(exactOf("ans", { ans: "≈1.2599210498948732" })).toBe("≈1.2599210498948732"));
  it("…and typed back in", () => expect(exactOf("≈1.2599210498948732 × 1")).toBe("≈1.2599210498948732"));
  it("a small double", () => expect(exactOf("ans", { ans: "≈-1.5e-7" })).toBe("≈-1.5e-7"));
});

describe("powers past the smallest number kept", () => {
  const exactOf = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "exact" in r ? r.exact : "error: " + r.error; };
  it("1.05^(−10^6) is a tiny approximation", () => expect(exactOf("1.05^(−10^6)")).toMatch(/^≈5\.02261699\d*e-21190$/));
  it("1.05^(−10^7) is approximately 0", () => expect(exactOf("1.05^(−10^7)")).toBe("≈0"));
  it("2^(−10^6) too", () => expect(exactOf("2^(−10^6)")).toBe("≈0"));
  it("1.05^(10^7) is too large", () => expect(evaluate("1.05^(10^7)")).toEqual({ error: "Number is too large" }));
  // a power below the smallest number kept is ≈0, but not a real 0: dividing by it is too large, its log is worked out
  it("1 ÷ 1.05^(−10^7) is too large", () => expect(err("1/(1.05^(−10^7))")).toBe("Number is too large"));
  it("1 ÷ 2^(−10^6) is too large", () => expect(err("1/(2^(−10^6))")).toBe("Number is too large"));
  it("1 ÷ 1.05^(−10^400) too", () => expect(err("1/1.05^(−10^400)")).toBe("Number is too large"));
  it("2^(−10^6) ÷ 2^(−10^6) = 1", () => expect(v("2^(−10^6)/2^(−10^6)")).toBe("1"));
  it("2^(−10^6) ÷ 1.05^(−10^7)", () => expect(v("2^(−10^6)/1.05^(−10^7)")).toMatch(/^9\.88633675\d*×10⁻⁸⁹¹³⁸$/));
  it("ln 2^(−10^6)", () => expect(v("ln(2^(−10^6))")).toBe("-693147.180559945"));
  it("log 1.05^(−10^7)", () => expect(v("log(1.05^(−10^7))")).toMatch(/^-211892\.99069938/));
  it("log₂ 2^(−10^6)", () => expect(v("log₂(2^(−10^6))")).toBe("-1000000"));
  it("ln of a negative one", () => expect(err("ln(−2^(−10^6))")).toBe("Logarithm of zero or less"));
  it("√2^(−10^6) is ≈0 too", () => expect(exactOf("√(2^(−10^6))")).toBe("≈0"));
  it("∛ of a negative one", () => expect(exactOf("∛(−2^(−10^6))")).toBe("≈0"));
  it("√ of a negative one", () => expect(err("√(−2^(−10^6))")).toBe("Root of a negative number"));
  it("a power of it that comes back in range", () => expect(v("(2^(−10^6))^(−0.1)")).toMatch(/^9\.990020\d*×10³⁰¹⁰²$/));
  it("1 + 2^(−10^6) ≈ 1", () => expect(exactOf("1 + 2^(−10^6)")).toBe("≈1"));
  it("2^(−10^6) − 2^(−10^6) ≈ 0", () => expect(exactOf("2^(−10^6) − 2^(−10^6)")).toBe("≈0"));
  it("2^(−10^6) × 2^300000 is still ≈0", () => expect(exactOf("2^(−10^6) × 2^300000")).toBe("≈0"));
  it("10^−60000 × 10^−60000 is ≈0, not too large", () => expect(exactOf("10^-60000 × 10^-60000")).toBe("≈0"));
  it("…and 1 ÷ it is too large", () => expect(err("1/(10^-60000 × 10^-60000)")).toBe("Number is too large"));
  it("(√2×10^−400)^1000 is ≈0", () => expect(exactOf("(√2×10^-400)^1000")).toBe("≈0"));
  it("0 × 2^(−10^6) = 0", () => expect(v("0 × 2^(−10^6)")).toBe("0"));
  it("2^(−10^6) ÷ 0", () => expect(err("2^(−10^6)/0")).toBe("Division by zero"));
  it("ceil and floor of it", () => { expect(v("ceil(2^(−10^6))")).toBe("1"); expect(v("floor(−2^(−10^6))")).toBe("-1"); expect(v("floor(2^(−10^6))")).toBe("0"); });
  it("sgn of it", () => expect(v("sgn(−2^(−10^6))")).toBe("-1"));
  it("−2^(−10^6) mod 7 ≈ 7", () => expect(v("(−2^(−10^6)) mod 7")).toBe("7"));
  it("Γ of it is too large", () => expect(err("gamma(2^(−10^6))")).toBe("Number is too large"));
  // a real 0 is still a division by zero
  it("1 ÷ (√2 − √2)", () => expect(err("1/(√2−√2)")).toBe("Division by zero"));
  it("1 ÷ 0", () => expect(err("1/0")).toBe("Division by zero"));
  it("1 ÷ (1 − 1)", () => expect(err("1/(1−1)")).toBe("Division by zero"));
  it("ln 0", () => expect(err("ln(0)")).toBe("Logarithm of zero or less"));
  it("log(√2 − √2)", () => expect(err("log(√2−√2)")).toBe("Logarithm of zero or less"));
  it("√(√2 − √2) is 0", () => expect(v("√(√2−√2)")).toBe("0"));
});
