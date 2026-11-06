// Works out a typed expression. Exact fractions while the maths allows it (0.1 + 0.2 = 0.3, 1 ÷ 3 × 3 = 1, 2^100 in
// full, √16 = 4, 8^(1/3) = 2, sin 30° = 0.5, log 1000 = 3); a double only for what is irrational, rounded to its
// trustworthy digits before anything discrete (floor, factorial, mod) and before it is shown. Beyond a double's range an
// inexact result (√(2×10^1000)) is an approximation marked as one (see format.ts), never digits passed off as exact.
// Every step takes bounded time, whatever is typed: the preview works it out on every key press.
import {
  type Q, CalcError, q, ZERO, ONE, add, sub, mul, div, neg, isInt, cmp, floor, trunc, powInt, rootExact, rootApprox, lnQ, toNumber, parseDecimal, withBudget, OverBudget,
  powNum, exponent10, bitLength, MAX_BITS,
} from "./rational";
import { type Value, type FormatOptions, asQ, formatValue, exactText, parseStored, approx, precision, cleanFloat, APPROX_DIGITS } from "./format";
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
const isApprox = (v: Value): v is { a: Q; p: number } => "a" in v;
/** Below the smallest number kept, but not 0 (see Value) */
type Tiny = { m: number; e: number; p: number };
const isTiny = (v: Value): v is Tiny => "m" in v;
/** x × 10^e (x a double ≠ 0) as a tiny value, good to p digits */
function tiny(x: number, e: number, p: number): Tiny {
  if (!Number.isFinite(e)) return { m: Math.sign(x), e, p: 1 }; // too small even for a log (1.05^(−10^400))
  const k = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** k;
  if (Math.abs(m) >= 10) { m /= 10; e++; } else if (Math.abs(m) < 1) { m *= 10; e--; }
  return { m, e: e + k, p };
}
const num = (v: Value) => (exact(v) ? toNumber(v.q) : "f" in v ? v.f : isTiny(v) ? 0 : toNumber(v.a));
/** The value as a fraction for working on beyond a double's range: exact, a double's 15 digits, or the approximation
 *  (a tiny value is 0 here: the callers that care deal with it first) */
const qOf = (v: Value): Q => (exact(v) ? v.q : "f" in v ? cleanFloat(v.f) : isTiny(v) ? ZERO : v.a);
const sgn = (v: Value) => { const x = exact(v) ? v.q.n : "a" in v ? v.a.n : isTiny(v) ? v.m : v.f; return x > 0 ? 1 : x < 0 ? -1 : 0; };
const negV = (v: Value): Value => (exact(v) ? { q: neg(v.q) } : "a" in v ? { a: neg(v.a), p: v.p } : isTiny(v) ? { ...v, m: -v.m } : fl(-v.f));
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
const lnOf = (v: Value) => ("f" in v ? Math.log(v.f) : isTiny(v) ? (v.e + Math.log10(Math.abs(v.m))) * Math.LN10 : lnQ(exact(v) ? v.q : v.a));
/** log10 |v| for v ≠ 0, also beyond a double and for a tiny value */
const log10Of = (v: Value) => (isTiny(v) ? v.e + Math.log10(Math.abs(v.m)) : lnOf(absV(v)) / Math.LN10);
/** v ≠ 0 as m × 10^e: a double's own digits when it fits in one (so 1000 × tiny ÷ tiny is 1000 to every digit),
 *  else by its logarithm */
function meOf(v: Value): [number, number] {
  if (isTiny(v)) return [v.m, v.e];
  const x = num(v);
  if (x !== 0 && Number.isFinite(x)) return [x, 0];
  const l = log10Of(v), e = Math.floor(l);
  return [sgn(v) * 10 ** (l - e), e];
}
/** A tiny value is not whole (Γ(tiny) is huge, tiny! ≈ 1) */
const intOf = (v: Value) => { if (isTiny(v)) return null; const a = asQ(v); return isInt(a) ? a.n : null; };
/** sign × 10^l, worked out by logarithms: below the smallest number kept a tiny value, past the largest "Number is too
 *  large". Its digits are those of a double's log of that size (fewer when the logs it came from were large: `big`). */
function fromL10(s: number, l: number, p = 15, big = 0): Value {
  const e = Math.floor(l);
  return fromME(Number.isFinite(e) ? s * 10 ** (l - e) : s, e, Math.max(1, Math.min(p, 15.5 - Math.log10(Math.max(1, Math.abs(l), Math.abs(big))))));
}
/** m × 10^e (m a double ≠ 0, e whole): a tiny value below the smallest number kept, else the number to p digits */
function fromME(m: number, e: number, p: number): Value {
  const l = e + Math.log10(Math.abs(m));
  // an exponent that can't be known (−∞ − −∞: the quotient of two numbers too small even for their log) is not ≈0
  if (Number.isNaN(l)) throw new CalcError("Not precise enough");
  if (!(l >= UNDERFLOW_L10)) return tiny(m, e, p);
  if (l > MAX_BITS * Math.LOG10E * Math.LN2) throw new CalcError("Number is too large");
  const M = BigInt(Math.round(m * 1e14)), k = e - 14;
  return approx(k >= 0 ? q(M * 10n ** BigInt(k)) : q(M, 10n ** BigInt(-k)), p);
}
/** a × b or a ÷ b (both ≠ 0) by their m × 10^e: for a tiny value, or a result that would be one */
function mulME(op: "*" | "/", a: Value, b: Value): Value {
  const [ma, ea] = meOf(a), [mb, eb] = meOf(b);
  return op === "*" ? fromME(ma * mb, ea + eb, Math.min(precision(a), precision(b))) : fromME(ma / mb, ea - eb, Math.min(precision(a), precision(b)));
}

/** + − × ÷ with a tiny value. Next to any other number it is lost in + and − (1 + tiny ≈ 1); × and ÷ go by logarithms,
 *  so 1 ÷ tiny is "Number is too large" and tiny ÷ tiny is worked out, while ÷ a real 0 is still "Division by zero". */
function arithTiny(op: "+" | "-" | "*" | "/", a: Value, b: Value): Value {
  if (op === "+" || op === "-") {
    const c = op === "-" ? negV(b) : b;
    if (!isTiny(a) || !isTiny(c)) {
      const x = isTiny(a) ? c : a;
      if (sgn(x) === 0) return isTiny(a) ? a : c;
      // no longer exact: 1 + tiny is 1 only approximately
      return exact(x) ? approx(x.q, APPROX_DIGITS) : x;
    }
    const [hi, lo] = a.e >= c.e ? [a, c] : [c, a];
    const x = !(hi.e - lo.e <= 20) ? hi.m : hi.m + lo.m * 10 ** (lo.e - hi.e);
    // two tiny values that cancel (2^(−10^6) − 2^(−10^6)): approximately 0, like two doubles
    return x === 0 ? fl(0) : tiny(x, hi.e, Math.min(a.p, c.p));
  }
  if (op === "/" && sgn(b) === 0) throw new CalcError("Division by zero");
  if (sgn(a) === 0 || sgn(b) === 0) return fl(0);
  return mulME(op, a, b);
}

function arith(op: "+" | "-" | "*" | "/", a: Value, b: Value): Value {
  if (isTiny(a) || isTiny(b)) return arithTiny(op, a, b);
  try { return arithQ(op, a, b); } catch (e) {
    // a product or quotient below the smallest number kept (10^−60000 × 10^−60000) is tiny, not "too large"
    if (tooLarge(e) && (op === "*" || op === "/") && sgn(a) !== 0 && sgn(b) !== 0) {
      const l = op === "*" ? log10Of(a) + log10Of(b) : log10Of(a) - log10Of(b);
      if (l < UNDERFLOW_L10) return mulME(op, a, b);
    }
    throw e;
  }
}
function arithQ(op: "+" | "-" | "*" | "/", a: Value, b: Value): Value {
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
    // a whole power past the largest number kept exactly (1.05^(−10^7) has 211,894 digits) is approximated below instead
    if (isInt(b.q)) { try { return { q: powInt(a.q, b.q.n) }; } catch (e) { if (!tooLarge(e)) throw e; } }
    // a rational power p/r: exact when the r-th root comes out (8^(1/3) = 2, 4^1.5 = 8)
    else if (b.q.d <= 1000n) {
      const r = rootExact(a.q, Number(b.q.d));
      // (10^−60000)^(5/2): the root comes out but its power is past the largest number kept: by logarithms below
      if (r) { try { return { q: powInt(r, b.q.n) }; } catch (e) { if (!tooLarge(e)) throw e; } }
    }
  }
  if (isTiny(a) || isTiny(b)) return powTiny(a, b);
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
    const l = log10Of(m) * Number(b.q.n);
    if (l < UNDERFLOW_L10) return fromL10(sign, l); // (≈10^−400)^1000
    return approx(mul(q(BigInt(sign)), powInt(m.a, b.q.n)), p - Math.log10(Math.abs(Number(b.q.n))));
  }
  const r = powNum(qOf(m), qOf(b));
  // an exponent past a double (1.05^(−10^309)) makes powNum's log10 infinite, though the log10 of the result,
  // log10 m × b ≈ −2.119×10^307, may still fit in one: worked out as 10^(log10 |log10 m| + log10 |b|), so the
  // same power gives the same log (1.05^(−10^309) ÷ 1.05^(−10^309) ≈ 1); past even that (1.05^(−10^400), log10
  // ≈ −2.1×10^398) it stays ∓∞, and what can't be known from it is "Not precise enough" (fromME, logBase)
  if ("l10" in r && !Number.isFinite(r.l10)) {
    const la = log10Of(m);
    r.l10 = Math.sign(la) * sgn(b) * 10 ** (Math.log10(Math.abs(la)) + log10Of(b));
  }
  if ("f" in r) return precision(m) === Infinity && precision(b) === Infinity ? fl(sign * r.f) : approx(mul(q(BigInt(sign)), cleanFloat(r.f)), Math.min(p, 15));
  // smaller than the smallest number kept ((10^−60000)^2): a tiny value, before the exact power below is built past
  // the largest number kept and says "too large"
  if (r.l10 < UNDERFLOW_L10) return fromL10(sign, r.l10, p);
  // a root out of a double's range gets its 30 digits ((−2×10^1000)^(1/3) like ∛(−2×10^1000))
  if (exact(m) && exact(b) && b.q.d <= 400n && b.q.n >= -1000n && b.q.n <= 1000n) {
    const rt = rootApprox(m.q, Number(b.q.d));
    return approx(mul(q(BigInt(sign)), powInt(rt, b.q.n)), 30 - Math.log10(Math.abs(Number(b.q.n))));
  }
  // smaller than the smallest number the calculator holds (10^−100000): a tiny value, ≈0 but not a real 0
  return fromL10(sign, r.l10, p);
}
/** log10 of the smallest number kept, the mirror of the largest (MAX_BITS) */
const UNDERFLOW_L10 = -MAX_BITS * Math.log10(2) + 20; // (with room for the 15 digits of a number just above it)
/** A power with a tiny base or exponent, by logarithms */
function powTiny(a: Value, b: Value): Value {
  if (isTiny(b)) {
    // x^tiny is 1 to every digit there is; 0^tiny is 0 (or 1 ÷ 0 for a negative tiny)
    if (sgn(a) === 0) { if (b.m < 0) throw new CalcError("Division by zero"); return fl(0); }
    if (sgn(a) < 0) throw new CalcError("Not a real number");
    return fl(1);
  }
  const t = a as Tiny, y = num(b);
  if (sgn(b) === 0) return exact(b) ? { q: ONE } : fl(1);
  let sign = 1;
  if (t.m < 0) {
    if (exact(b) ? !isInt(b.q) : !Number.isInteger(y)) throw new CalcError("Not a real number");
    if (exact(b) ? b.q.n % 2n !== 0n : y % 2 !== 0) sign = -1;
  }
  const l = log10Of(t);
  return fromL10(sign, l * y, precision(b), l);
}
const tooLarge = (e: unknown) => e instanceof CalcError && e.message === "Number is too large";

function root(a: Value, n: number): Value {
  if (!Number.isInteger(n) || n === 0) throw new CalcError("Malformed expression");
  const sa = sgn(a);
  if (sa < 0 && n % 2 === 0) throw new CalcError("Root of a negative number");
  if (isTiny(a)) { const l = log10Of(a); return fromL10(sa, l / n, 15, l); }
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
  if (isTiny(v)) return fl(1); // Γ(1 + tiny)
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
  // a tiny value as a stand-in small number: floor and ceil come out whole, frac keeps the value itself
  if (isTiny(v)) { const t = q(BigInt(Math.sign(v.m)), 10n ** 20n), r = f(t); return cmp(r, t) === 0 ? v : { q: r }; }
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
  // −∞ ÷ −∞: both too small even for their log (log(1.05^(−10^1000); 1.05^(−10^1000)))
  if (Number.isNaN(r)) throw new CalcError("Not precise enough");
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
const tooBig = (e: unknown) => e instanceof OverBudget || tooLarge(e);
const FIN_POW_BITS = 1000;
const ONE_V: Value = { q: ONE };
/** x^n when it comes out exact at a sensible size, else null */
function finExactPow(x: Value, n: Value): Value | null {
  if (!exact(x) || !exact(n) || (bitLength(x.q.n) + bitLength(x.q.d)) * Math.abs(toNumber(n.q)) > FIN_POW_BITS) return null;
  try { const r = pow(x, n); return exact(r) ? r : null; } catch (e) { if (tooBig(e)) return null; throw e; }
}
/** ln(1 + v) without forming 1 + v as a double (which loses a small rate's digits) */
function ln1p(v: Value): Value {
  const x = num(v);
  if (isTiny(v)) return v;
  if (x !== 0 && Number.isFinite(x)) return fl(Math.log1p(x));
  if (sgn(v) === 0) return Z;
  // a rate beyond a double: ln(1 + v) is v itself when that small (10^−400), to far more digits than a double has
  return x === 0 ? approx(qOf(v), 15) : fl(lnOf(arith("+", ONE_V, v)));
}
const FIN: FinOps<Value> = {
  int: (n) => ({ q: q(n) }),
  add: (a, b) => arith("+", a, b), sub: (a, b) => arith("-", a, b), mul: (a, b) => arith("*", a, b), div: (a, b) => arith("/", a, b),
  pow: (a, b) => {
    if (exact(a) && exact(b) && isInt(b.q) && (bitLength(a.q.n) + bitLength(a.q.d)) * Math.abs(toNumber(b.q)) > FIN_POW_BITS) return pow(fl(num(a)), b);
    try { return pow(a, b); } catch (e) { if (exact(a) && tooBig(e)) return pow(fl(num(a)), b); throw e; }
  },
  // exact when the power comes out at a sensible size, else expm1 / log1p on doubles (accurate for any small rate), and
  // only past a double's range the power itself, approximated
  grow: (i, n) => {
    if (isTiny(i)) return arith("*", n, i); // ≈ n·i
    const base = arith("+", ONE_V, i), r = finExactPow(base, n);
    if (r) return arith("-", r, ONE_V);
    const x = num(i);
    if (x !== 0) { const g = Math.expm1(Math.log1p(x) * num(n)); if (Number.isFinite(g)) return fl(g); }
    else { const t = mul(qOf(n), qOf(i)); if (Math.abs(toNumber(t)) < 1e-17) return approx(t, 15); } // ≈ n·i
    return arith("-", FIN.pow(base, n), ONE_V);
  },
  rootm1: (x, n) => {
    const e = arith("/", ONE_V, n), r = finExactPow(x, e);
    if (r) return arith("-", r, ONE_V);
    const g = Math.expm1(lnOf(x) / num(n));
    if (Number.isFinite(g)) return fl(g);
    return arith("-", FIN.pow(x, e), ONE_V);
  },
  logp1: (y, i) => {
    const r = arith("/", ln1p(y), ln1p(i)), x = num(r), k = Math.round(x);
    // a whole number of periods is checked exactly (Ctrm(0.1; 121; 100) = 2)
    if (exact(y) && exact(i) && Number.isFinite(x) && Math.abs(x - k) < 1e-9 * Math.max(1, Math.abs(k))) {
      try { if (cmp(powInt(add(ONE, i.q), BigInt(k)), add(ONE, y.q)) === 0) return { q: q(BigInt(k)) }; } catch (e) { if (!tooBig(e)) throw e; }
    }
    return r;
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
    case "sgn": return { q: q(BigInt(sgn(a))) };
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
        if (isTiny(b)) throw new CalcError("Not precise enough for mod");
        const x = asQ(a), y = asQ(b);
        if (y.n === 0n) throw new CalcError("Division by zero");
        // the sign follows the divisor: tiny mod 7 is tiny, −tiny mod 7 is 7 − tiny ≈ 7
        if (isTiny(a)) return sgn(a) === sgn(b) ? a : arith("+", a, b);
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
