// Exact fractions of big integers. Sums people type (0.1 + 0.2, 1 ÷ 3 × 3, 2^100) stay exact; only results that are
// irrational (roots that don't come out, trig, logarithms) leave this type for a float.

export interface Q { n: bigint; d: bigint } // n / d, d > 0, always reduced

export class CalcError extends Error {}

const abs = (a: bigint) => (a < 0n ? -a : a);
export const bitLength = (a: bigint) => { const h = abs(a).toString(16); return (h.length - 1) * 4 + 32 - Math.clz32(parseInt(h[0]!, 16)); };

/** The biggest exact number kept: about 100,000 digits. Past that a sum takes seconds and nobody reads the digits. */
export const MAX_BITS = 332_200;
const LIMIT = 1n << BigInt(MAX_BITS);
/** log10 of the smallest number kept, the mirror of the largest (with room for the 15 digits of a number just above
 *  it): below it a number is a tiny value (format.ts) */
export const UNDERFLOW_L10 = -MAX_BITS * Math.log10(2) + 20;
const tooLarge = () => new CalcError("Number is too large");

/** Thrown when a number grows past a smaller limit asked for (a preview while typing must answer at once) */
export class OverBudget extends Error {}
let budget = MAX_BITS, budgetBig = LIMIT;
/** Runs f with numbers limited to `bits` (at most MAX_BITS) */
export function withBudget<T>(bits: number | undefined, f: () => T): T {
  const old = budget;
  budget = Math.min(bits ?? MAX_BITS, MAX_BITS); budgetBig = 1n << BigInt(budget);
  try { return f(); } finally { budget = old; budgetBig = 1n << BigInt(old); }
}
const overLimit = (bits: number) => { if (bits > MAX_BITS) throw tooLarge(); if (bits > budget) throw new OverBudget(); };

const trailingZeros = (a: bigint) => bitLength(a & -a) - 1;

// Lehmer's gcd: the Euclidean steps are worked out on the leading 48 bits as ordinary numbers and applied to the big
// numbers in one go, many bits per pass instead of one big division per 1.7 bits (the textbook loop took seconds on
// numbers with tens of thousands of digits). Factors of 2 are taken out first: powers of 2 (and of 10) are common
// denominators and then cost nothing.
const DIGIT = 48;
export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  if (a === 0n || b === 0n) return a || b;
  const za = trailingZeros(a), zb = trailingZeros(b), z = BigInt(Math.min(za, zb));
  a >>= BigInt(za); b >>= BigInt(zb);
  if (a < b) [a, b] = [b, a];
  let la = bitLength(a);
  while (b > 0xffffffffffffn) {
    while ((a >> BigInt(la - 1)) === 0n) la--; // cheaper than bitLength(a) on every pass
    const k = BigInt(la - DIGIT);
    let x = Number(a >> k), y = Number(b >> k), A = 1, B = 0, C = 0, D = 1;
    for (;;) {
      if (y + C <= 0 || y + D <= 0) break;
      const q1 = Math.floor((x + A) / (y + C)), q2 = Math.floor((x + B) / (y + D));
      if (q1 !== q2) break;
      let t = A - q1 * C; A = C; C = t;
      t = B - q1 * D; B = D; D = t;
      t = x - q1 * y; x = y; y = t;
    }
    if (B === 0) [a, b] = [b, a % b];
    else [a, b] = [BigInt(A) * a + BigInt(B) * b, BigInt(C) * a + BigInt(D) * b];
  }
  while (b) [a, b] = [b, a % b];
  return a << z;
}
export const q = (n: bigint, d: bigint = 1n): Q => {
  if (d === 0n) throw new CalcError("Division by zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return checked(n / g, d / g);
};
/** n / d as it is (already reduced), refused when past the limit */
const checked = (n: bigint, d: bigint): Q => {
  if (n >= budgetBig || -n >= budgetBig || d >= budgetBig) overLimit(Math.max(bitLength(n), bitLength(d)));
  return { n, d };
};
export const ZERO = q(0n), ONE = q(1n);
// The sum and product of reduced fractions with the gcds taken on the parts (Knuth 4.5.1): smaller numbers than the
// whole result, and none at all for whole numbers
export const add = (a: Q, b: Q): Q => {
  if (a.d === 1n && b.d === 1n) return checked(a.n + b.n, 1n);
  const g = gcd(a.d, b.d);
  if (g === 1n) return checked(a.n * b.d + b.n * a.d, a.d * b.d);
  const t = a.n * (b.d / g) + b.n * (a.d / g);
  if (t === 0n) return { n: 0n, d: 1n };
  const g2 = gcd(t, g);
  return checked(t / g2, (a.d / g) * (b.d / g2));
};
export const sub = (a: Q, b: Q) => add(a, { n: -b.n, d: b.d });
export const mul = (a: Q, b: Q): Q => {
  const g1 = gcd(a.n, b.d), g2 = gcd(b.n, a.d);
  return checked((a.n / (g1 || 1n)) * (b.n / (g2 || 1n)), (a.d / (g2 || 1n)) * (b.d / (g1 || 1n)));
};
export const div = (a: Q, b: Q) => {
  if (b.n === 0n) throw new CalcError("Division by zero");
  return mul(a, b.n < 0n ? { n: -b.d, d: -b.n } : { n: b.d, d: b.n });
};
export const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const isInt = (a: Q) => a.d === 1n;
export const cmp = (a: Q, b: Q) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
/** Rounded towards minus infinity */
export const floor = (a: Q): bigint => { const t = a.n / a.d; return a.n < 0n && t * a.d !== a.n ? t - 1n : t; };
/** Rounded towards zero */
export const trunc = (a: Q): bigint => a.n / a.d;

/** Exact a^k for a whole k; refuses results too big to be worth writing out (millions of digits) */
export function powInt(a: Q, k: bigint): Q {
  if (k === 0n) return ONE;
  if (a.n === 0n) { if (k < 0n) throw new CalcError("Division by zero"); return ZERO; }
  // the size of the answer is known before working it out, so 2^1000000 is refused at once instead of after seconds
  const l = Math.max(log2Big(abs(a.n)), log2Big(a.d));
  if (l > 0) overLimit(Number(abs(k)) * l);
  let n = 1n, d = 1n, bn = a.n, bd = a.d, x = abs(k);
  while (x > 0n) { if (x & 1n) { n *= bn; d *= bd; } x >>= 1n; if (x) { bn *= bn; bd *= bd; } }
  // a power of a reduced fraction is reduced: no gcd needed
  if (k > 0n) return checked(n, d);
  return n < 0n ? checked(-d, -n) : checked(d, n);
}

/** The whole k-th root of a ≥ 0 if a is a perfect k-th power, else null */
function irootExact(a: bigint, k: number): bigint | null {
  if (a < 0n) return null;
  const x = iroot(a, k);
  return x ** BigInt(k) === a ? x : null;
}
/** The whole part of the k-th root of a ≥ 0 */
function iroot(a: bigint, k: number): bigint {
  if (a < 2n) return a;
  // below 2^k the root is between 1 and 2 (root(10^400; 100000) answers at once)
  if (bitLength(a) <= k) return 1n;
  const K = BigInt(k);
  // Newton's method from just above the root: the estimate from the leading bits is close, so it takes a few steps
  // instead of hundreds when k is large ((10^400)^(1/999))
  const l = log2Big(a) / k, sh = Math.max(0, Math.floor(l) - 60);
  let x = (BigInt(Math.ceil(2 ** (l - sh) * (1 + 1e-12))) + 1n) << BigInt(sh);
  for (;;) {
    const y = ((K - 1n) * x + a / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
}
/** The k-th root of a > 0 to 32 significant digits (cut off, not rounded), as a fraction: for roots too big or too
 *  small for a double (√(2×10^1000) = 1.41421356237×10^500). An approximation: the caller keeps it marked as one.
 *  Only for small k (a root beyond a double's range of a number within MAX_BITS has k ≤ 330): the work grows with k. */
export function rootApprox(a: Q, k: number): Q {
  if (k > 1000) throw tooLarge();
  // s: decimals of the root to keep, so that it has at least 32 digits
  const s = 32 - Math.floor(exponent10(a) / k);
  const n = BigInt(Math.abs(s) * k), p = 10n ** BigInt(Math.abs(s));
  const r = iroot(s >= 0 ? (a.n * 10n ** n) / a.d : a.n / (a.d * 10n ** n), k);
  return s >= 0 ? q(r, p) : q(r * p);
}

/** x op y (y ≠ 0 for ÷) for an approximate answer: each side cut to 40 significant digits first (an approximation has
 *  at most 32), so the working numbers stay the size of the answer. The exact quotient of two approximations' fractions
 *  can be far past the largest number kept though the answer is not (√(2×10^99999) ÷ √(3×10^−99999)). */
export function approxOp(op: "+" | "-" | "*" | "/", x: Q, y: Q): Q {
  const G = 40;
  if (x.n === 0n || y.n === 0n) return op === "+" ? add(x, y) : op === "-" ? sub(x, y) : op === "*" ? mul(x, y) : div(x, y);
  if (op === "+" || op === "-") {
    // both on the scale of the larger one's 40th digit: a much smaller side is lost in it, as it would be in the answer
    const u = Math.max(exponent10(x), exponent10(y)) - G, X = scaledRound(x, u), Y = scaledRound(y, u);
    return fromScaled(op === "+" ? X + Y : X - Y, u);
  }
  const ex = exponent10(x) - G, ey = exponent10(y) - G, X = scaledRound(x, ex), Y = scaledRound(y, ey);
  if (op === "*") return fromScaled(X * Y, ex + ey);
  const t = (2n * abs(X) * 10n ** BigInt(G) + abs(Y)) / (2n * abs(Y));
  return fromScaled((X < 0n) !== (Y < 0n) ? -t : t, ex - ey - G);
}
/** a ÷ 10^u rounded to a whole number (half away from zero) */
function scaledRound(a: Q, u: number): bigint {
  const n = abs(a.n), num = u < 0 ? n * 10n ** BigInt(-u) : n, den = u > 0 ? a.d * 10n ** BigInt(u) : a.d;
  const r = (2n * num + den) / (2n * den);
  return a.n < 0n ? -r : r;
}
const fromScaled = (m: bigint, u: number): Q => (u >= 0 ? q(m * 10n ** BigInt(u)) : q(m, 10n ** BigInt(-u)));

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

/** log2 of a positive big integer, from its leading bits (cheap: no decimal digits) */
function log2Big(a: bigint): number {
  const b = bitLength(a);
  if (b <= 1000) return Math.log2(Number(a));
  return b - 60 + Math.log2(Number(a >> BigInt(b - 60)));
}
/** |a| ≠ 0 as m × 2^t with m in [1, 2) to double precision: the leading bits of the fraction, so numbers far beyond a
 *  double (10^400, 10^-400) still give their logarithm and roots to full double precision */
function split2(a: Q): { m: number; t: number } {
  const n = abs(a.n), s = bitLength(n) - bitLength(a.d) - 62;
  const x = s >= 0 ? n / (a.d << BigInt(s)) : (n << BigInt(-s)) / a.d; // 61 to 63 bits
  const m = Number(x) / 2 ** 62;
  return m >= 2 ? { m: m / 2, t: s + 63 } : m < 1 ? { m: m * 2, t: s + 61 } : { m, t: s + 62 };
}
const LOG10_2 = Math.log10(2);
/** m × 2^t without overflowing on the way (2^t alone may not fit a double) */
const scale2 = (m: number, t: number) => (t > 1100 ? Infinity : t < -1200 ? 0 : m * 2 ** Math.trunc(t / 2) * 2 ** (t - Math.trunc(t / 2)));

/** The natural logarithm of a > 0, also when a is far beyond a double (ln(10^400) = 921.03…) */
export function lnQ(a: Q): number {
  const { m, t } = split2(a);
  // near 1 the leading bits round to 1 (1 + 10^−30 has m = 1, so ln would be 0): ln(1 + x) from x = a − 1 itself
  if (t === 0 || t === -1) return Math.log1p(toNumber(sub(a, ONE)));
  return Math.log(m) + t * Math.LN2;
}

/** The nearest double (Infinity when out of range, 0 when too small) */
export function toNumber(a: Q): number {
  if (a.n === 0n) return 0;
  const n = abs(a.n);
  // both exact as doubles: one division, correctly rounded
  if (n <= 1n << 53n && a.d <= 1n << 53n) return Number(a.n) / Number(a.d);
  // else Number(n) / Number(d) rounds three times and can be one unit off in the 17th digit (14.142135623730951 read
  // back as 14.142135623730953): the quotient to 66 bits with a sticky last bit, rounded once by Number()
  const s = bitLength(n) - bitLength(a.d) - 66;
  const nn = s >= 0 ? n : n << BigInt(-s), dd = s >= 0 ? a.d << BigInt(s) : a.d;
  let x = nn / dd;
  if (x * dd !== nn) x |= 1n;
  return (a.n < 0n ? -1 : 1) * scale2(Number(x), s);
}

/** a^y for a > 0 and any y, as a double when it fits in one ({ f }), else as its log10 ({ l10 }, for a value beyond a
 *  double's range). Works from a = m × 2^t, so a far beyond a double still gives a full-precision double
 *  (root(10^400; 100000) = 1.00925…, (10^400)^(1/999) = 2.5164…) in constant time. */
export function powNum(a: Q, y: Q): { f: number } | { l10: number } {
  const { m, t } = split2(a);
  // a base near 1 ((1 + 10^−30)^(10^29) = e^0.1): m rounds to 1, so by ln(1 + x) instead (an infinite or unknown
  // exponent, ln × y not finite, is left to the caller below)
  if (t === 0 || t === -1) {
    const l = lnQ(a) * toNumber(y);
    if (Number.isFinite(l)) return l < 709 && l > -690 ? { f: Math.exp(l) } : { l10: l * Math.LOG10E };
  }
  const ty = mul(q(BigInt(t)), y), M = floor(ty), F = toNumber(sub(ty, q(M))); // t·y = M + F, 0 ≤ F < 1
  const yf = toNumber(y), my = m ** yf * 2 ** F;
  if (Number.isFinite(my) && my > 0 && M > -1300n && M < 1300n) {
    const r = scale2(my, Number(M));
    if (Number.isFinite(r) && Math.abs(r) >= 1e-300) return { f: r };
  }
  return { l10: (Number(M) + F + yf * Math.log2(m)) * LOG10_2 };
}

/** a rounded to `digits` significant digits (half away from zero) */
export function roundSig(a: Q, digits: number): Q {
  if (a.n === 0n) return a;
  const k = exponent10(a) - digits + 1, n = abs(a.n);
  // r = |a| / 10^k rounded
  const num = k >= 0 ? n : n * 10n ** BigInt(-k), den = k >= 0 ? a.d * 10n ** BigInt(k) : a.d;
  const r = ((2n * num + den) / (2n * den)) * (a.n < 0n ? -1n : 1n);
  return k >= 0 ? q(r * 10n ** BigInt(k)) : q(r, 10n ** BigInt(-k));
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
