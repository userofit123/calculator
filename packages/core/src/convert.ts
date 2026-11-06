// Converting an amount between units of a category (units.ts) or currencies (currency.ts). The amount is any
// expression the calculator understands ("3/4", "2^10", "12 × 1.5"), worked out by the same engine; it goes through the
// category's base unit with exact fractions wherever the amount and both unit definitions are exact (1 ft = 0.3048 m,
// 1 mi = 1.609344 km, 100 °C = 212 °F exactly), and as a double only for units defined through π.
import { evaluate, type EvalOptions, type EvalResult } from "./evaluate";
import { type Value, type FormatOptions, parseStored, formatValue, exactText, asQ, approx, precision } from "./format";
import { type Q, CalcError, add, sub, mul, div, q, trunc, toFixed, parseDecimal } from "./rational";
import type { Category, Unit } from "./units";

const cache = new Map<string, Value>();
/** A unit's factor or offset, worked out once */
function constant(expr: string): Value {
  let v = cache.get(expr);
  if (!v) {
    const r = evaluate(expr);
    if (!("exact" in r)) throw new Error(`Unit definition "${expr}": ${r.error}`);
    cache.set(expr, (v = parseStored(r.exact)));
  }
  return v;
}

/** a op b: exact when both are, else to the digits the less precise one can be trusted with */
function op(a: Value, b: Value, f: (x: Q, y: Q) => Q): Value {
  if ("q" in a && "q" in b) return { q: f(a.q, b.q) };
  return approx(f(asQ(a), asQ(b)), Math.min(precision(a), precision(b)));
}
const isZero = (v: Value) => asQ(v).n === 0n;

export function toBase(u: Unit, x: Value): Value {
  if (u.inverse) {
    if (isZero(x)) throw new CalcError("Can't convert zero");
    return op(constant(u.factor), x, div);
  }
  return op(u.offset ? op(x, constant(u.offset), add) : x, constant(u.factor), mul);
}
export function fromBase(u: Unit, b: Value): Value {
  if (u.inverse) {
    if (isZero(b)) throw new CalcError("Can't convert zero");
    return op(constant(u.factor), b, div);
  }
  const v = op(b, constant(u.factor), div);
  return u.offset ? op(v, constant(u.offset), sub) : v;
}

/** Degrees as degrees, minutes and seconds: 12.5125 → 12° 30′ 45″ (seconds to `places` decimals, at most 6) */
export function formatDms(v: Value, places = 2): string {
  const x = asQ(v), negative = x.n < 0n, a = negative ? { n: -x.n, d: x.d } : x;
  let d = trunc(a);
  const rm = mul(sub(a, q(d)), q(60n));
  let m = trunc(rm);
  let s = toFixed(mul(sub(rm, q(m)), q(60n)), Math.max(0, Math.min(6, places)));
  // seconds rounded up to a whole minute carry over (59.999″ → 1′)
  if (Number(s) >= 60) { s = "0"; m += 1n; }
  if (m >= 60n) { m -= 60n; d += 1n; }
  const out = `${d}° ${m}′ ${s}″`;
  return negative && out !== "0° 0′ 0″" ? "-" + out : out;
}

/** "12° 30′ 45″", "12°30'45\"", "12 30 45" or "12d 30m": degrees, minutes and seconds typed in; null if it's not that */
export function parseDms(text: string): Q | null {
  const m = /^\s*([-−]?)\s*(\d+(?:\.\d+)?)\s*(?:°|d|deg)?\s*(?:(\d+(?:\.\d+)?)\s*(?:′|'|m|min)?\s*(?:(\d+(?:\.\d+)?)\s*(?:″|"|''|s|sec)?)?)?\s*$/.exec(text);
  if (!m || (!m[3] && !/[°d]/.test(text))) return null; // a plain number is an expression like any other
  let v = add(add(parseDecimal(m[2]!), div(parseDecimal(m[3] ?? "0"), q(60n))), div(parseDecimal(m[4] ?? "0"), q(3600n)));
  if (m[1]) v = { n: -v.n, d: v.d };
  return v;
}

/** Works out the typed amount (the same engine and options as the calculator), as a value */
function amountValue(from: Unit, amount: string, o: EvalOptions): Value | { error: string } {
  if (from.dms) { const d = parseDms(amount); if (d) return { q: d }; }
  const r = evaluate(amount, o);
  if ("error" in r) return r;
  if (r.assigned) return { error: "Can't store a variable here" };
  return parseStored(r.exact);
}

function show(u: Unit, v: Value, o: FormatOptions): { value: string; exact: string } {
  return { value: u.dms ? formatDms(v, o.decimals ?? 2) : formatValue(v, o), exact: exactText(v) };
}
const unitOf = (c: Category, id: string) => {
  const u = c.units.find((x) => x.id === id);
  if (!u) throw new CalcError(`Unknown unit ${id}`);
  return u;
};
function attempt<T>(f: () => T): T | { error: string } {
  try { return f(); } catch (e) {
    if (e instanceof CalcError) return { error: e.message === "Division by zero" ? "Can't convert zero" : e.message };
    if (e instanceof RangeError) return { error: "Number is too large" };
    throw e;
  }
}

/** The significant digits a converted amount is shown to (FormatOptions.significant): enough for any real use, short
 *  enough to read at a glance; whole numbers keep all their digits and copying gives the value in full */
export const CONVERT_DIGITS = 10;

/** The amount (an expression) in unit `from` converted to unit `to`: value as shown (decimal "."), exact in full */
export function convert(c: Category, from: string, to: string, amount: string, o: EvalOptions = {}): EvalResult {
  return attempt(() => {
    const f = unitOf(c, from), t = unitOf(c, to), a = amountValue(f, amount, o);
    if ("error" in a) return a;
    return show(t, fromBase(t, toBase(f, a)), o);
  });
}

/** The amount in every unit of the category, in the category's order */
export function convertAll(c: Category, from: string, amount: string, o: EvalOptions = {}): { unit: Unit; result: EvalResult }[] | { error: string } {
  return attempt(() => {
    const f = unitOf(c, from), a = amountValue(f, amount, o);
    if ("error" in a) return a;
    const b = toBase(f, a);
    return c.units.map((unit) => ({ unit, result: attempt(() => show(unit, fromBase(unit, b), o)) }));
  });
}
