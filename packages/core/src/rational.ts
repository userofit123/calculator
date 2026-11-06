// Exact fractions of big integers. Sums people type (0.1 + 0.2, 1 ÷ 3 × 3, 2^100) stay exact; only results that are
// irrational (roots that don't come out, trig, logarithms) leave this type for a float.

export interface Q { n: bigint; d: bigint } // n / d, d > 0, always reduced

export class CalcError extends Error {}

const abs = (a: bigint) => (a < 0n ? -a : a);
export const gcd = (a: bigint, b: bigint): bigint => { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const q = (n: bigint, d: bigint = 1n): Q => {
  if (d === 0n) throw new CalcError("Division by zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
export const ZERO = q(0n), ONE = q(1n);
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q) => { if (b.n === 0n) throw new CalcError("Division by zero"); return q(a.n * b.d, a.d * b.n); };
export const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const isInt = (a: Q) => a.d === 1n;
export const cmp = (a: Q, b: Q) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
/** Rounded towards minus infinity */
export const floor = (a: Q): bigint => { const t = a.n / a.d; return a.n < 0n && t * a.d !== a.n ? t - 1n : t; };
/** Rounded towards zero */
export const trunc = (a: Q): bigint => a.n / a.d;

export const bitLength = (a: bigint) => abs(a).toString(2).length;

/** Exact a^k for a whole k; refuses results too big to be worth writing out (millions of digits) */
export function powInt(a: Q, k: bigint): Q {
  if (k === 0n) return ONE;
  if (a.n === 0n) { if (k < 0n) throw new CalcError("Division by zero"); return ZERO; }
  const bits = BigInt(Math.max(bitLength(a.n), bitLength(a.d)));
  if (bits > 1n && abs(k) * bits > 4_000_000n) throw new CalcError("Number is too large");
  const e = abs(k);
  let n = 1n, d = 1n, bn = a.n, bd = a.d, x = e;
  while (x > 0n) { if (x & 1n) { n *= bn; d *= bd; } bn *= bn; bd *= bd; x >>= 1n; }
  return k < 0n ? q(d, n) : q(n, d);
}

/** The whole k-th root of a ≥ 0 if a is a perfect k-th power, else null */
export function irootExact(a: bigint, k: number): bigint | null {
  if (a < 0n) return null;
  if (a < 2n) return a;
  const K = BigInt(k);
  // Newton's method from an estimate above the root
  let x = 1n << BigInt(Math.ceil(bitLength(a) / k) + 1);
  for (;;) {
    const y = ((K - 1n) * x + a / x ** (K - 1n)) / K;
    if (y >= x) break;
    x = y;
  }
  return x ** K === a ? x : null;
}

/** The exact k-th root of a rational (k ≥ 2), or null when it isn't rational */
export function rootExact(a: Q, k: number): Q | null {
  if (a.n < 0n) {
    if (k % 2 === 0) return null;
    const r = rootExact(neg(a), k);
    return r && neg(r);
  }
  const n = irootExact(a.n, k), d = irootExact(a.d, k);
  return n !== null && d !== null ? q(n, d) : null;
}

/** log10 of a positive big integer, good to double precision */
function log10Big(a: bigint): number {
  const s = a.toString();
  if (s.length <= 300) return Math.log10(Number(a));
  return s.length - 17 + Math.log10(Number(s.slice(0, 17)));
}

/** The nearest double (Infinity when out of range) */
export function toNumber(a: Q): number {
  if (a.n === 0n) return 0;
  const x = Number(a.n) / Number(a.d);
  if (Number.isFinite(x) && x !== 0) return x;
  const l = log10Big(abs(a.n)) - log10Big(a.d);
  return (a.n < 0n ? -1 : 1) * 10 ** l;
}

/** A decimal or scientific number written as text ("12.5", ".5", "1.2e-7"), exactly */
export function parseDecimal(s: string): Q {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s.trim());
  if (!m || (!m[2] && !m[3])) throw new CalcError("Malformed expression");
  const f = m[3] ?? "", e = Number(m[4] ?? 0);
  if (Math.abs(e) > 100000) throw new CalcError("Number is too large");
  let v = q(BigInt((m[2] || "0") + f), 10n ** BigInt(f.length));
  if (e) v = mul(v, powInt(q(10n), BigInt(e)));
  return m[1] === "-" ? neg(v) : v;
}

/** floor(log10(|a|)) exactly, for a ≠ 0 */
export function exponent10(a: Q): number {
  const n = abs(a.n);
  let e = n.toString().length - a.d.toString().length;
  // 10^e ≤ |a| < 10^(e+1)
  const ge = (k: number) => (k >= 0 ? n >= a.d * 10n ** BigInt(k) : n * 10n ** BigInt(-k) >= a.d);
  while (!ge(e)) e--;
  while (ge(e + 1)) e++;
  return e;
}

/** a rounded to `places` decimals (half away from zero) as plain text, trailing zeros dropped, "-0" shown as "0" */
export function toFixed(a: Q, places: number): string {
  const ng = a.n < 0n, n = abs(a.n), scale = 10n ** BigInt(places);
  const r = (n * scale * 2n + a.d) / (a.d * 2n);
  const ip = r / scale, fp = places ? (r % scale).toString().padStart(places, "0").replace(/0+$/, "") : "";
  const out = ip.toString() + (fp ? "." + fp : "");
  return ng && out !== "0" ? "-" + out : out;
}
