// Works out a typed expression. Exact fractions while the maths allows it (0.1 + 0.2 = 0.3, 1 ÷ 3 × 3 = 1, 2^100 in
// full, √16 = 4, 8^(1/3) = 2, sin 30° = 0.5, log 1000 = 3); a double only for what is irrational, rounded to its
// trustworthy digits before anything discrete (floor, factorial, mod) and before it is shown.
import {
  type Q, CalcError, q, ZERO, ONE, add, sub, mul, div, neg, isInt, cmp, floor, trunc, powInt, rootExact, toNumber, parseDecimal,
} from "./rational";
import { type Value, type FormatOptions, asQ, formatValue, exactText, parseStored } from "./format";
import { parse, type Node } from "./parse";

export type AngleUnit = "deg" | "rad" | "grad";
export interface EvalOptions extends FormatOptions {
  /** Unit of trigonometry arguments and inverse trigonometry results (default degrees, like GNOME's calculator) */
  angle?: AngleUnit;
  /** Stored variables, name → value as written by a previous result's `exact` */
  variables?: Record<string, string>;
  /** The previous answer (its `exact`), reachable as "ans" */
  ans?: string;
}
/** value: the answer as shown (decimal "."); exact: the answer in full, to keep as ans, memory or a variable;
 *  assigned: the variable the expression stored ("x = 5") */
export type EvalResult = { value: string; exact: string; assigned?: string } | { error: string };

const CONSTANTS: Record<string, Value> = { "π": { f: Math.PI }, pi: { f: Math.PI }, e: { f: Math.E } };
const RESERVED = new Set(["ans", "mod", ...Object.keys(CONSTANTS)]);

const exact = (v: Value): v is { q: Q } => "q" in v;
const num = (v: Value) => (exact(v) ? toNumber(v.q) : v.f);
const fl = (x: number): Value => {
  if (Number.isNaN(x)) throw new CalcError("Not a real number");
  if (!Number.isFinite(x)) throw new CalcError("Number is too large");
  return { f: x };
};
const Z: Value = { q: ZERO };
const intOf = (v: Value) => { const a = asQ(v); return isInt(a) ? a.n : null; };

function arith(op: "+" | "-" | "*" | "/", a: Value, b: Value): Value {
  if (exact(a) && exact(b)) return { q: op === "+" ? add(a.q, b.q) : op === "-" ? sub(a.q, b.q) : op === "*" ? mul(a.q, b.q) : div(a.q, b.q) };
  const x = num(a), y = num(b);
  if (op === "/" && (exact(b) ? b.q.n === 0n : y === 0)) throw new CalcError("Division by zero");
  return fl(op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : x / y);
}

function pow(a: Value, b: Value): Value {
  if (exact(b) && exact(a)) {
    if (isInt(b.q)) return { q: powInt(a.q, b.q.n) };
    // a rational power p/r: exact when the r-th root comes out (8^(1/3) = 2, 4^1.5 = 8)
    if (b.q.d <= 1000n) {
      const r = rootExact(a.q, Number(b.q.d));
      if (r) return { q: powInt(r, b.q.n) };
      if (a.q.n < 0n && b.q.d % 2n === 1n) return fl(-(Math.abs(toNumber(a.q)) ** toNumber(b.q))); // odd root of a negative
    }
  }
  const x = num(a), y = num(b);
  if (x === 0 && y < 0) throw new CalcError("Division by zero");
  return fl(x ** y);
}

function root(a: Value, n: number): Value {
  if (!Number.isInteger(n) || n === 0) throw new CalcError("Malformed expression");
  if (exact(a)) {
    if (a.q.n < 0n && n % 2 === 0) throw new CalcError("Root of a negative number");
    const r = rootExact(a.q, Math.abs(n));
    if (r) return n < 0 ? { q: div(ONE, r) } : { q: r };
  }
  const x = num(a);
  if (x < 0 && n % 2 === 0) throw new CalcError("Root of a negative number");
  const r = Math.sign(x) * Math.abs(x) ** (1 / Math.abs(n));
  return fl(n < 0 ? 1 / r : r);
}

// Lanczos approximation (g = 7), for factorials of non-whole numbers
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = LG[0]!;
  for (let i = 1; i < 9; i++) x += LG[i]! / (z + i);
  const t = z + 7.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}
function factorial(v: Value): Value {
  const n = intOf(v);
  if (n === null) return fl(gamma(num(v) + 1));
  if (n < 0n) throw new CalcError("Factorial of a negative number");
  if (n > 5000n) throw new CalcError("Number is too large");
  let r = 1n;
  for (let i = 2n; i <= n; i++) r *= i;
  return { q: q(r) };
}

/** The angle in degrees as an exact fraction, when the unit allows it (degrees and gradians typed exactly) */
function exactDegrees(v: Value, unit: AngleUnit): Q | null {
  if (!exact(v) || unit === "rad") return unit === "rad" && exact(v) && v.q.n === 0n ? ZERO : null;
  const d = unit === "grad" ? mul(v.q, q(9n, 10n)) : v.q;
  // reduced into [0, 360)
  return sub(d, mul(q(360n), q(floor(div(d, q(360n))))));
}
const toRad = (x: number, unit: AngleUnit) => (unit === "deg" ? (x * Math.PI) / 180 : unit === "grad" ? (x * Math.PI) / 200 : x);
const fromRad = (x: number, unit: AngleUnit) => (unit === "deg" ? (x * 180) / Math.PI : unit === "grad" ? (x * 200) / Math.PI : x);
// sin at the angles where it is rational, in degrees within [0, 360)
const SIN_EXACT: Record<string, Q> = { "0": ZERO, "30": q(1n, 2n), "90": ONE, "150": q(1n, 2n), "180": ZERO, "210": q(-1n, 2n), "270": q(-1n), "330": q(-1n, 2n) };
const TAN_EXACT: Record<string, Q | null> = { "0": ZERO, "45": ONE, "90": null, "135": q(-1n), "180": ZERO, "225": ONE, "270": null, "315": q(-1n) };
const key = (d: Q) => (isInt(d) ? d.n.toString() : "");
// a double that should have been 0 (sin π = 1.2e-16) is 0
const snap = (x: number) => (Math.abs(x) < 1e-15 ? 0 : x);

function trig(f: "sin" | "cos" | "tan", v: Value, unit: AngleUnit): Value {
  const d = exactDegrees(v, unit);
  if (d) {
    const dd = f === "cos" ? sub(q(90n), d) : d; // cos t = sin(90 - t)
    const r = (x: Q) => sub(x, mul(q(360n), q(floor(div(x, q(360n))))));
    if (f === "tan") {
      const k = key(d);
      if (k in TAN_EXACT) { const t = TAN_EXACT[k]; if (!t) throw new CalcError("Tangent is undefined here"); return { q: t }; }
    } else {
      const k = key(r(dd));
      if (k in SIN_EXACT) return { q: SIN_EXACT[k]! };
    }
  }
  const x = toRad(num(v), unit);
  if (f === "sin") return fl(snap(Math.sin(x)));
  if (f === "cos") return fl(snap(Math.cos(x)));
  if (Math.abs(Math.cos(x)) < 1e-15) throw new CalcError("Tangent is undefined here");
  return fl(snap(Math.tan(x)));
}

/** log of x in a base, exact when x is a whole power of the base (log 1000 = 3, log₂ 8 = 3) */
function logBase(v: Value, base: Value): Value {
  const x = num(v), b = num(base);
  if ((exact(v) ? v.q.n <= 0n : x <= 0)) throw new CalcError("Logarithm of zero or less");
  if (b <= 0 || b === 1) throw new CalcError("Invalid logarithm base");
  const r = Math.log(x) / Math.log(b);
  const k = Math.round(r);
  if (exact(v) && exact(base) && Math.abs(r - k) < 1e-9 && cmp(powInt(base.q, BigInt(k)), v.q) === 0) return { q: q(BigInt(k)) };
  return fl(r);
}

const ALIAS: Record<string, string> = { arcsin: "asin", arccos: "acos", arctan: "atan", arsinh: "asinh", arcosh: "acosh", artanh: "atanh", sqrt: "√", cbrt: "∛", fact: "!" };

function call(name: string, args: Value[], o: EvalOptions): Value {
  let f = name.startsWith("inv:") ? "a" + name.slice(4) : name;
  f = ALIAS[f] ?? f;
  const unit = o.angle ?? "deg";
  const need = (n: number) => { if (args.length !== n) throw new CalcError(`${name.replace("inv:", "")} takes ${n === 1 ? "one number" : n + " numbers"}`); };
  const sub0 = /^log([₀-₉]+)$/.exec(f);
  if (sub0) { need(1); return logBase(args[0]!, { q: q(BigInt([...sub0[1]!].map((c) => c.charCodeAt(0) - 0x2080).join(""))) }); }
  if (f === "log") {
    if (args.length === 2) return logBase(args[0]!, args[1]!);
    need(1); return logBase(args[0]!, { q: q(10n) });
  }
  if (f === "root") { need(2); const n = intOf(args[1]!); if (n === null) throw new CalcError("Root needs a whole number"); return root(args[0]!, Number(n)); }
  need(1);
  const a = args[0]!, x = () => num(a);
  switch (f) {
    case "sin": case "cos": case "tan": return trig(f, a, unit);
    case "asin": case "acos": {
      if (Math.abs(x()) > 1) throw new CalcError("Out of range for " + f);
      if (exact(a) && unit !== "rad") { // the angles that come out whole: 0, ±30, ±90 (and acos of them)
        const s = Object.entries(SIN_EXACT).find(([k, v]) => cmp(v, a.q) === 0 && (Number(k) <= 90 || Number(k) >= 270));
        if (s) { let deg = Number(s[0]) >= 270 ? Number(s[0]) - 360 : Number(s[0]); if (f === "acos") deg = 90 - deg; return { q: unit === "deg" ? q(BigInt(deg)) : mul(q(BigInt(deg)), q(10n, 9n)) }; }
      }
      return fl(fromRad(f === "asin" ? Math.asin(x()) : Math.acos(x()), unit));
    }
    case "atan": return fl(fromRad(Math.atan(x()), unit));
    case "sinh": return exact(a) && a.q.n === 0n ? Z : fl(Math.sinh(x()));
    case "cosh": return exact(a) && a.q.n === 0n ? { q: ONE } : fl(Math.cosh(x()));
    case "tanh": return exact(a) && a.q.n === 0n ? Z : fl(Math.tanh(x()));
    case "asinh": return exact(a) && a.q.n === 0n ? Z : fl(Math.asinh(x()));
    case "acosh": if (x() < 1) throw new CalcError("Out of range for acosh"); return fl(Math.acosh(x()));
    case "atanh": if (Math.abs(x()) >= 1) throw new CalcError("Out of range for atanh"); return fl(Math.atanh(x()));
    case "ln": {
      if (exact(a) ? a.q.n <= 0n : x() <= 0) throw new CalcError("Logarithm of zero or less");
      return exact(a) && cmp(a.q, ONE) === 0 ? Z : fl(Math.log(x()));
    }
    case "exp": return exact(a) && a.q.n === 0n ? { q: ONE } : fl(Math.exp(x()));
    case "√": return root(a, 2);
    case "∛": return root(a, 3);
    case "abs": return exact(a) ? { q: a.q.n < 0n ? neg(a.q) : a.q } : fl(Math.abs(a.f));
    case "floor": return { q: q(floor(asQ(a))) };
    case "ceil": return { q: neg(q(floor(neg(asQ(a))))) };
    case "round": { const v = asQ(a), h = q(1n, 2n); return { q: q(v.n < 0n ? -floor(add(neg(v), h)) : floor(add(v, h))) }; }
    case "int": return { q: q(trunc(asQ(a))) };
    case "frac": { const v = asQ(a); return { q: sub(v, q(trunc(v))) }; }
    case "sgn": { const v = asQ(a); return { q: q(BigInt(v.n > 0n ? 1 : v.n < 0n ? -1 : 0)) }; }
    case "gamma": { const n = intOf(a); if (n !== null && n <= 0n) throw new CalcError("Gamma is undefined here"); return n !== null ? factorial({ q: q(n - 1n) }) : fl(gamma(x())); }
    case "!": return factorial(a);
  }
  throw new CalcError("Unknown function " + name);
}

function lookup(name: string, o: EvalOptions): Value | null {
  if (name === "ans") return o.ans ? parseStored(o.ans) : Z;
  const v = o.variables?.[name];
  if (v !== undefined) return parseStored(v);
  return CONSTANTS[name] ?? null;
}

function ev(n: Node, o: EvalOptions): Value {
  switch (n.k) {
    case "num": return { q: parseDecimal(n.text) };
    case "name": {
      const v = lookup(n.name, o);
      if (v) return v;
      // "xy" with x and y stored is x·y
      const parts = [...n.name];
      if (parts.length > 1 && parts.every((c) => lookup(c, o))) return parts.map((c) => lookup(c, o)!).reduce((a, b) => arith("*", a, b));
      throw new CalcError("Unknown variable " + n.name);
    }
    case "neg": { const a = ev(n.a, o); return exact(a) ? { q: neg(a.q) } : fl(-a.f); }
    case "pct": return arith("/", ev(n.a, o), { q: q(100n) });
    case "fact": return factorial(ev(n.a, o));
    case "root": return root(ev(n.a, o), n.n);
    case "call": return call(n.f, n.args.map((a) => ev(a, o)), o);
    case "bin": {
      const a = ev(n.a, o), b = ev(n.b, o);
      if (n.op === "^") return pow(a, b);
      if (n.op === "mod") {
        const x = asQ(a), y = asQ(b);
        if (y.n === 0n) throw new CalcError("Division by zero");
        return { q: sub(x, mul(y, q(floor(div(x, y))))) }; // the sign follows the divisor, like GNOME's
      }
      return arith(n.op, a, b);
    }
  }
}

/** Unknown names that look like a call ("foo(2)") are reported as an unknown function */
function unknownFunction(src: string, msg: string): string {
  const m = /^Unknown variable (\S+)$/.exec(msg);
  return m && new RegExp(`${m[1]}\\s*\\(`).test(src) ? `Unknown function ${m[1]}` : msg;
}

export function evaluate(expression: string, options: EvalOptions = {}): EvalResult {
  try {
    const st = parse(expression);
    if (st.assign && RESERVED.has(st.assign)) throw new CalcError(`Can't change ${st.assign}`);
    const v = ev(st.expr, options);
    const value = formatValue(v, options);
    return { value, exact: exactText(v), ...(st.assign ? { assigned: st.assign } : {}) };
  } catch (e) {
    if (e instanceof CalcError) return { error: unknownFunction(expression, e.message) };
    if (e instanceof RangeError) return { error: "Number is too large" }; // a BigInt past the engine's limits
    return { error: "Malformed expression" };
  }
}
