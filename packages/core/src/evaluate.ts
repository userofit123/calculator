// Works out a typed expression. Exact fractions while the maths allows it (0.1 + 0.2 = 0.3, 1 ÷ 3 × 3 = 1, 2^100 in
// full, √16 = 4, 8^(1/3) = 2, sin 30° = 0.5, log 1000 = 3); a double only for what is irrational, rounded to its
// trustworthy digits before anything discrete (floor, factorial, mod) and before it is shown. Beyond a double's range an
// inexact result (√(2×10^1000)) is an approximation marked as one (see format.ts), never digits passed off as exact.
// Every step takes bounded time, whatever is typed: the preview works it out on every key press.
import {
  type Q, CalcError, q, ZERO, ONE, add, sub, mul, div, neg, isInt, cmp, floor, trunc, powInt, rootExact, rootApprox, lnQ, toNumber, parseDecimal, withBudget, OverBudget,
  powNum, fromLog10, exponent10, bitLength,
} from "./rational";
import { type Value, type FormatOptions, asQ, formatValue, exactText, parseStored, approx, precision, cleanFloat } from "./format";
import { parse, type Node } from "./parse";
import { financial, financialName, type FinOps } from "./financial";

export type AngleUnit = "deg" | "rad" | "grad";
export interface EvalOptions extends FormatOptions {
  /** Unit of trigonometry arguments and inverse trigonometry results (default degrees, like GNOME's calculator) */
  angle?: AngleUnit;
  /** Stored variables, name → value as written by a previous result's `exact` */
  variables?: Record<string, string>;
  /** The previous answer (its `exact`), reachable as "ans" */
  ans?: string;
  /** A lower size limit in bits, for a preview worked out on every key press: anything bigger is not worked out
   *  (an error), so the preview of 3^200000 ÷ 2^330000 can't hold up typing. The = key leaves it out. */
  maxBits?: number;
}
/** value: the answer as shown (decimal "."); exact: the answer in full, to keep as ans, memory or a variable;
 *  assigned: the variable the expression stored ("x = 5") */
export type EvalResult = { value: string; exact: string; assigned?: string } | { error: string };

const CONSTANTS: Record<string, Value> = { "π": { f: Math.PI }, pi: { f: Math.PI }, e: { f: Math.E } };
/** Names that can't be variables (functions can't either, see FUNCTIONS) */
export const RESERVED = new Set(["ans", "mod", ...Object.keys(CONSTANTS)]);
const own = (o: object | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);

const exact = (v: Value): v is { q: Q } => "q" in v;
const num = (v: Value) => (exact(v) ? toNumber(v.q) : "f" in v ? v.f : toNumber(v.a));
const isApprox = (v: Value): v is { a: Q; p: number } => "a" in v;
/** The value as a fraction for working on beyond a double's range: exact, a double's 15 digits, or the approximation */
const qOf = (v: Value): Q => (exact(v) ? v.q : "f" in v ? cleanFloat(v.f) : v.a);
const sgn = (v: Value) => { const x = exact(v) ? v.q.n : "a" in v ? v.a.n : v.f; return x > 0 ? 1 : x < 0 ? -1 : 0; };
const negV = (v: Value): Value => (exact(v) ? { q: neg(v.q) } : "a" in v ? { a: neg(v.a), p: v.p } : fl(-v.f));
const absV = (v: Value): Value => (sgn(v) < 0 ? negV(v) : v);
/** A value a double can't hold: exact beyond its range, or an approximation (always beyond it) */
const big = (v: Value) => isApprox(v) || (exact(v) && outOfDouble(v.q));
const fl = (x: number): Value => {
  if (Number.isNaN(x)) throw new CalcError("Not a real number");
  if (!Number.isFinite(x)) throw new CalcError("Number is too large");
  return { f: x };
};
const Z: Value = { q: ZERO };
/** An exact value a double can't hold (beyond 1.8×10^308, or so small that it would be 0) */
const outOfDouble = (a: Q) => { const x = Math.abs(toNumber(a)); return a.n !== 0n && (!Number.isFinite(x) || x < 1e-300); };
/** ln of a value; exact values beyond a double still work (ln(10^400)) */
const lnOf = (v: Value) => ("f" in v ? Math.log(v.f) : lnQ(exact(v) ? v.q : v.a));
const intOf = (v: Value) => { const a = asQ(v); return isInt(a) ? a.n : null; };

function arith(op: "+" | "-" | "*" | "/", a: Value, b: Value): Value {
  const exactOp = (x: Q, y: Q) => (op === "+" ? add(x, y) : op === "-" ? sub(x, y) : op === "*" ? mul(x, y) : div(x, y));
  if (exact(a) && exact(b)) return { q: exactOp(a.q, b.q) };
  if (op === "/" && sgn(b) === 0) throw new CalcError("Division by zero");
  if (!big(a) && !big(b)) {
    const x = num(a), y = num(b), r = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : x / y;
    // a product or quotient past a double's range is worked out below instead ((√2 × 10^200)^2 × 10^200)
    if (op === "+" || op === "-" || (Number.isFinite(r) && (r !== 0 || x === 0))) return fl(r);
  }
  // beyond a double: on the fractions, to the digits the less precise side has
  const x = qOf(a), y = qOf(b), r = exactOp(x, y);
  let p = Math.min(precision(a), precision(b));
  // a difference of nearly equal numbers keeps only the digits that didn't cancel (1.41…×10^500 − 1.41…×10^500)
  // (to at least the one digit that is left, from the guard digits an approximation carries)
  if ((op === "+" || op === "-") && r.n !== 0n) p = Math.max(1, p - (Math.max(x.n ? exponent10(x) : -Infinity, y.n ? exponent10(y) : -Infinity) - exponent10(r)));
  return approx(r, p);
}

function pow(a: Value, b: Value): Value {
  if (exact(b) && exact(a)) {
    if (isInt(b.q)) return { q: powInt(a.q, b.q.n) };
    // a rational power p/r: exact when the r-th root comes out (8^(1/3) = 2, 4^1.5 = 8)
    if (b.q.d <= 1000n) { const r = rootExact(a.q, Number(b.q.d)); if (r) return { q: powInt(r, b.q.n) }; }
  }
  const sa = sgn(a);
  if (sa === 0) { if (num(b) < 0) throw new CalcError("Division by zero"); return fl(0 ** num(b)); }
  // a negative number to a power: real for an odd root ((−8)^(1/3) = −2) and for whole powers
  let sign = 1;
  if (sa < 0) {
    if (exact(b) && !isInt(b.q)) {
      if (b.q.d % 2n === 0n) throw new CalcError("Not a real number");
      if (b.q.n % 2n !== 0n) sign = -1;
    } else {
      const y = num(b);
      if (!Number.isInteger(y)) throw new CalcError("Not a real number");
      if (exact(b) ? b.q.n % 2n !== 0n : y % 2 !== 0) sign = -1;
    }
  }
  const m = absV(a);
  if (!big(m) && !isApprox(b)) {
    const r = num(m) ** num(b);
    if (Number.isFinite(r) && r !== 0) return fl(sign * r);
  }
  // beyond a double's range (in or out)
  let p = Math.min(precision(m), precision(b));
  if (isApprox(m) && exact(b) && isInt(b.q) && b.q.n >= -10000n && b.q.n <= 10000n) {
    return approx(mul(q(BigInt(sign)), powInt(m.a, b.q.n)), p - Math.log10(Math.abs(Number(b.q.n))));
  }
  const r = powNum(qOf(m), qOf(b));
  if ("f" in r) return precision(m) === Infinity && precision(b) === Infinity ? fl(sign * r.f) : approx(mul(q(BigInt(sign)), cleanFloat(r.f)), Math.min(p, 15));
  // a root out of a double's range gets its 30 digits ((−2×10^1000)^(1/3) like ∛(−2×10^1000))
  if (exact(m) && exact(b) && b.q.d <= 400n && b.q.n >= -1000n && b.q.n <= 1000n) {
    const rt = rootApprox(m.q, Number(b.q.d));
    return approx(mul(q(BigInt(sign)), powInt(rt, b.q.n)), 30 - Math.log10(Math.abs(Number(b.q.n))));
  }
  return approx(mul(q(BigInt(sign)), fromLog10(r.l10)), Math.min(p, 15.5 - Math.log10(Math.max(1, Math.abs(r.l10)))));
}

function root(a: Value, n: number): Value {
  if (!Number.isInteger(n) || n === 0) throw new CalcError("Malformed expression");
  const sa = sgn(a);
  if (sa < 0 && n % 2 === 0) throw new CalcError("Root of a negative number");
  if (exact(a)) {
    const r = rootExact(a.q, Math.abs(n));
    if (r) return n < 0 ? { q: div(ONE, r) } : { q: r };
  }
  if (sa === 0) { if (n < 0) throw new CalcError("Division by zero"); return Z; }
  const m = absV(a), k = Math.abs(n);
  if (!big(m)) {
    const r = sa * num(m) ** (1 / k);
    return fl(n < 0 ? 1 / r : r);
  }
  // beyond a double's range: by logarithms when the root fits in a double (root(10^400; 100000), in constant time),
  // else to 30 digits (√(2×10^1000) = 1.41421356237…×10^500; then k ≤ 330, as the number has at most 100,000 digits)
  const x = qOf(m), p = precision(m), r = powNum(x, q(n < 0 ? -1n : 1n, BigInt(k)));
  if ("f" in r) return exact(m) ? fl(sa * r.f) : approx(cleanFloat(sa * r.f), Math.min(p, 15));
  const rt = rootApprox(x, k);
  return approx(mul(q(BigInt(sa)), n < 0 ? div(ONE, rt) : rt), Math.min(p, 30));
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

/** floor, round and the like: on the value's trustworthy digits. Of an approximate number with more whole digits than
 *  it is sure of (3.1×10^20 as a double, √(2×10^1000)) the result is approximate too, not made-up exact digits. */
function discrete(v: Value, f: (x: Q) => Q): Value {
  const x = asQ(v), r = f(x);
  if (exact(v) || x.n === 0n || exponent10(x) < precision(v)) return { q: r };
  return approx(r, precision(v));
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
  if (sgn(v) <= 0) throw new CalcError("Logarithm of zero or less");
  if (sgn(base) <= 0 || (exact(base) ? cmp(base.q, ONE) === 0 : num(base) === 1)) throw new CalcError("Invalid logarithm base");
  const r = lnOf(v) / lnOf(base);
  const k = Math.round(r);
  if (exact(v) && exact(base) && Math.abs(r - k) < 1e-9 * Math.max(1, Math.abs(k))) {
    // a power too large to check is not the value either
    try { if (cmp(powInt(base.q, BigInt(k)), v.q) === 0) return { q: q(BigInt(k)) }; } catch (e) { if (!(e instanceof CalcError)) throw e; }
  }
  return fl(r);
}

// The financial functions' arithmetic: exact while the numbers stay a sensible size. A compounding factor of thousands
// of digits ((241/240)^360 for a 30-year mortgage) is worked out as a double instead: nobody needs a payment as a
// 1,400-digit fraction, and it would fill history and ans. A whole-power check too big to try is skipped the same way.
const tooBig = (e: unknown) => e instanceof OverBudget || (e instanceof CalcError && e.message === "Number is too large");
const FIN_POW_BITS = 1000;
const FIN: FinOps<Value> = {
  int: (n) => ({ q: q(n) }),
  add: (a, b) => arith("+", a, b), sub: (a, b) => arith("-", a, b), mul: (a, b) => arith("*", a, b), div: (a, b) => arith("/", a, b),
  pow: (a, b) => {
    if (exact(a) && exact(b) && isInt(b.q) && (bitLength(a.q.n) + bitLength(a.q.d)) * Math.abs(toNumber(b.q)) > FIN_POW_BITS) return pow(fl(num(a)), b);
    try { return pow(a, b); } catch (e) { if (exact(a) && tooBig(e)) return pow(fl(num(a)), b); throw e; }
  },
  log: (x, base) => {
    try { return logBase(x, base); } catch (e) { if (tooBig(e)) return fl(lnOf(x) / lnOf(base)); throw e; }
  },
  sgn, whole: intOf,
};

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
  if (financialName(f)) return financial(f, args, FIN);
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
      if (sgn(a) <= 0) throw new CalcError("Logarithm of zero or less");
      return exact(a) && cmp(a.q, ONE) === 0 ? Z : fl(lnOf(a));
    }
    case "exp": return exact(a) && a.q.n === 0n ? { q: ONE } : fl(Math.exp(x()));
    case "√": return root(a, 2);
    case "∛": return root(a, 3);
    case "abs": return absV(a);
    case "floor": return discrete(a, (v) => q(floor(v)));
    case "ceil": return discrete(a, (v) => neg(q(floor(neg(v)))));
    case "round": return discrete(a, (v) => { const h = q(1n, 2n); return q(v.n < 0n ? -floor(add(neg(v), h)) : floor(add(v, h))); });
    case "int": return discrete(a, (v) => q(trunc(v)));
    case "frac": return discrete(a, (v) => sub(v, q(trunc(v))));
    case "sgn": { const v = asQ(a); return { q: q(BigInt(v.n > 0n ? 1 : v.n < 0n ? -1 : 0)) }; }
    case "gamma": { const n = intOf(a); if (n !== null && n <= 0n) throw new CalcError("Gamma is undefined here"); return n !== null ? factorial({ q: q(n - 1n) }) : fl(gamma(x())); }
    case "!": return factorial(a);
  }
  throw new CalcError("Unknown function " + name);
}

function lookup(name: string, o: EvalOptions): Value | null {
  if (name === "ans") return o.ans ? parseStored(o.ans) : Z;
  // own names only: "constructor" or "toString" are not stored variables
  if (own(o.variables, name)) return parseStored(o.variables![name]!);
  return own(CONSTANTS, name) ? CONSTANTS[name]! : null;
}

function ev(n: Node, o: EvalOptions): Value {
  switch (n.k) {
    case "num": return n.text.startsWith("≈") ? parseStored(n.text) : { q: parseDecimal(n.text) };
    case "name": {
      const v = lookup(n.name, o);
      if (v) return v;
      // "xy" with x and y stored is x·y
      const parts = [...n.name];
      if (parts.length > 1 && parts.every((c) => lookup(c, o))) return parts.map((c) => lookup(c, o)!).reduce((a, b) => arith("*", a, b));
      throw new CalcError("Unknown variable " + n.name);
    }
    case "neg": return negV(ev(n.a, o));
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
        const r = sub(x, mul(y, q(floor(div(x, y))))); // the sign follows the divisor, like GNOME's
        if (exact(a) && exact(b)) return { q: r };
        // of an approximate number, only the digits it is sure of count: (10^20·π) mod 7 can't be known
        const p = Math.min(precision(a), precision(b)) - (x.n === 0n ? 0 : Math.max(0, exponent10(x) - exponent10(y)));
        if (p < 1) throw new CalcError("Not precise enough for mod");
        return approx(r, p);
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
    return withBudget(options.maxBits, () => {
      const v = ev(st.expr, options);
      const value = formatValue(v, options);
      return { value, exact: exactText(v), ...(st.assign ? { assigned: st.assign } : {}) };
    });
  } catch (e) {
    if (e instanceof CalcError) return { error: unknownFunction(expression, e.message) };
    if (e instanceof OverBudget) return { error: "Too large to work out while typing" };
    if (e instanceof RangeError) return { error: "Number is too large" }; // a BigInt past the engine's limits
    return { error: "Malformed expression" };
  }
}
