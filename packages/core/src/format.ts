// Numbers as the user sees them. A value is an exact fraction or, after an irrational step, a double; doubles are
// rounded to 15 significant digits first, which hides float noise (0.30000000000000004, sin 30° = 0.49999999999999994)
// while keeping every digit a double can be trusted with. A value beyond a double's range that isn't exact
// (√(2×10^1000)) is an approximation marked as one: a fraction with the digits it can be trusted with (p), treated like
// a double (rounded to those digits before anything discrete and before it is shown, stored as "≈1.414…e500").
import { type Q, CalcError, exponent10, parseDecimal, toFixed, isInt, q, roundSig, toNumber } from "./rational";

/** q: exact; f: a double (15 trustworthy digits); a: an approximation beyond a double's range, good to p digits;
 *  m: a number below the smallest one kept (about 10^−100000) but not 0, m × 10^e (1 ≤ |m| < 10, e whole), good to p digits. It is shown
 *  and stored as ≈0, but dividing by it is "Number is too large" (not "Division by zero") and its log is worked out. */
export type Value = { q: Q } | { f: number } | { a: Q; p: number } | { m: number; e: number; p: number };
/** The most digits an approximation keeps */
export const APPROX_DIGITS = 30;
/** The digits a value can be trusted with (exact: all) */
export const precision = (v: Value) => ("q" in v ? Infinity : "f" in v ? 15 : v.p);
/** An approximate result to p digits: a double when it fits in one, else marked approximate (never as exact digits) */
export function approx(x: Q, p: number): Value {
  if (x.n === 0n || p < 1) return { f: 0 };
  const f = toNumber(x);
  if (Number.isFinite(f) && Math.abs(f) >= 1e-300) return { f };
  const d = Math.min(Math.floor(p), APPROX_DIGITS);
  return { a: roundSig(x, d + 2), p: d }; // two guard digits so rounding steps don't add up
}
/** fraction: an exact answer as a fraction (7/4); mixed: as a mixed number (1 3/4). Both show anything else (an
 *  approximation, a fraction too big to read) like auto, see fractionNote. */
export type NumberFormat = "auto" | "fixed" | "sci" | "eng" | "fraction" | "mixed";

// A fraction is only worth showing while it can be taken in at a glance: 355/113 is useful, 1234567/7654321 isn't
/** The largest denominator shown as a fraction */
export const MAX_DENOMINATOR = 1_000_000n;
/** The largest whole part (or numerator of a proper fraction) a fraction is shown with: past it ×10ⁿ reads better */
export const MAX_FRACTION_WHOLE = 10n ** 15n;

/** An exact non-whole value as a fraction: improper "-7/4" or mixed "-1 3/4" (a proper one is "3/4" either way), with a
 *  plain "/" (it can be typed and pasted back; the Unicode fraction slash needs font support and can't be typed) and a
 *  plain "-". null when it isn't one worth showing (whole, denominator past maxDen, whole part past MAX_FRACTION_WHOLE). */
export function fractionText(x: Q, mixed: boolean, maxDen: bigint = MAX_DENOMINATOR): string | null {
  if (x.d === 1n || x.d > maxDen) return null;
  const sign = x.n < 0n ? "-" : "", n = x.n < 0n ? -x.n : x.n, whole = n / x.d;
  if (whole >= MAX_FRACTION_WHOLE) return null;
  return mixed && whole > 0n ? `${sign}${whole} ${n % x.d}/${x.d}` : `${sign}${n}/${x.d}`;
}
/** Why an answer is shown as a decimal although fraction or mixed format is chosen ("" when it isn't) */
export function fractionNote(v: Value, format: NumberFormat | undefined, maxDen: bigint = MAX_DENOMINATOR): string {
  if (format !== "fraction" && format !== "mixed") return "";
  if (!("q" in v)) return "Not exact, so shown as a decimal";
  const x = v.q;
  if (x.d === 1n) return "";
  if (x.d > maxDen) return "Denominator over 1,000,000, so shown as a decimal";
  return fractionText(x, format === "mixed", maxDen) === null ? "Too large for a fraction, so shown as a decimal" : "";
}

export interface FormatOptions {
  /** Most digits after the decimal point (default 12) */
  decimals?: number;
  /** auto: plain, switching to ×10ⁿ for very large or small numbers; fixed: always plain; sci / eng: always ×10ⁿ */
  format?: NumberFormat;
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
export const toSuperscript = (s: string) => [...s].map((c) => SUP[c] ?? c).join("");

/** A double as an exact fraction of its 15 significant digits (the digits that are not noise) */
export function cleanFloat(x: number): Q {
  if (!Number.isFinite(x)) throw new CalcError(Number.isNaN(x) ? "Not a real number" : "Number is too large");
  if (Math.abs(x) < 1e-300) return q(0n);
  return parseDecimal(x.toPrecision(15));
}
/** The value as a fraction of its trustworthy digits: what anything discrete (floor, mod, factorial) works on */
export const asQ = (v: Value): Q => ("q" in v ? v.q : "f" in v ? cleanFloat(v.f) : "m" in v ? q(0n) : roundSig(v.a, v.p));

/** a ÷ 10^e, left unreduced: only rounded for showing, so a gcd of numbers with thousands of digits isn't worth it */
const by10 = (a: Q, e: number): Q => (e >= 0 ? { n: a.n, d: a.d * 10n ** BigInt(e) } : { n: a.n * 10n ** BigInt(-e), d: a.d });

function sci(a: Q, places: number, eng: boolean): string {
  let e = exponent10(a);
  if (eng) e = Math.floor(e / 3) * 3;
  let m = toFixed(by10(a, e), places);
  // rounding can carry over: 9.9999 → 10 (or 1000 in engineering steps)
  if (Math.abs(Number(m)) >= (eng ? 1000 : 10)) { e += eng ? 3 : 1; m = toFixed(by10(a, e), places); }
  return e === 0 ? m : `${m}×10${toSuperscript(String(e))}`;
}

/** The value as plain text with "." as the decimal point and no grouping (the form expressions are typed in) */
export function formatValue(v: Value, o: FormatOptions = {}): string {
  const places = Math.max(0, Math.min(30, o.decimals ?? 12));
  let fmt = o.format ?? "auto";
  if (fmt === "fraction" || fmt === "mixed") {
    // only an exact value is ever a fraction: an approximation shown as one would pass off made-up digits as exact
    const f = "q" in v ? fractionText(v.q, fmt === "mixed") : null;
    if (f !== null) return f;
    fmt = "auto";
  }
  const a = asQ(v);
  if (a.n === 0n) return "0";
  if (fmt === "fixed") return "a" in v ? sci(a, Math.min(places, 15), false) : toFixed(a, places);
  if (fmt === "sci" || fmt === "eng") return sci(a, Math.min(places, 15), fmt === "eng");
  const e = exponent10(a);
  // whole numbers are written out in full while they still fit on a wide screen (2^100 = 1267650600228229401496703205376);
  // an approximation never is: its digits past the trustworthy ones would be made-up zeros
  if (isInt(a) && "q" in v ? e >= 40 : e >= 21) return sci(a, Math.min(places, 15), false);
  const plain = toFixed(a, places);
  // too small to show at this many decimals: switch to ×10ⁿ instead of showing 0
  if (e < -6 || (plain === "0" || plain === "-0")) return sci(a, Math.min(places, 15), false);
  return plain;
}

/** The value in full (a fraction "n/d" or a double's shortest text), for storing an answer, memory or variable */
export function exactText(v: Value): string {
  if ("f" in v) {
    // a double is always marked "≈": it is approximate (2^(1/3), Pmt(1000; 10^−9; 360)) and must not be taken back as
    // exact digits when it is reused or shown as a stored value; it reads back as the same double
    return "≈" + String(v.f);
  }
  if ("a" in v) return approxText(v.a, v.p);
  if ("m" in v) return "≈0";
  return isInt(v.q) ? v.q.n.toString() : `${v.q.n}/${v.q.d}`;
}
/** x rounded to p significant digits, marked approximate: "≈1.41421356237309504880168872421e500" */
export function approxText(x: Q, p: number): string {
  const r = roundSig(x, p), e = exponent10(r), k = e - p + 1;
  // the p digits, trailing zeros kept: they say how many digits are trustworthy when read back
  const R = (r.n < 0n ? -r.n : r.n) * (k < 0 ? 10n ** BigInt(-k) : 1n) / (r.d * (k > 0 ? 10n ** BigInt(k) : 1n));
  const t = R.toString();
  return `≈${r.n < 0n ? "-" : ""}${t[0]}${t.length > 1 ? "." + t.slice(1) : ""}e${e}`;
}
/** Reads back what exactText wrote (also plain decimals) */
export function parseStored(s: string): Value {
  s = s.trim();
  if (s.startsWith("≈")) { // an approximation, to the digits written
    const t = s.slice(1), x = Number(t);
    if (Number.isFinite(x) && Math.abs(x) >= 1e-300) return { f: x }; // a double, exactly as it was
    const digits = t.replace(/[eE].*$/, "").replace(/\D/g, "").replace(/^0+/, "").length;
    return approx(parseDecimal(t), Math.max(1, Math.min(digits, APPROX_DIGITS)));
  }
  const m = /^(-?\d+)\/(\d+)$/.exec(s.trim());
  if (m) return { q: q(BigInt(m[1]!), BigInt(m[2]!)) };
  if (/[eE]/.test(s) || /\.\d{16,}/.test(s)) { const x = Number(s); if (Number.isFinite(x)) return { f: x }; }
  return { q: parseDecimal(s) };
}

export interface DisplayOptions {
  /** Group thousands (1,234,567) */
  thousands?: boolean;
  /** The decimal mark shown; with "," the thousands are grouped with "." */
  decimalMark?: "." | ",";
}
/** Turns typed or answered text (decimal ".", no grouping) into what is shown: the chosen decimal mark and grouping */
export function formatDisplay(s: string, o: DisplayOptions = {}): string {
  const mark = o.decimalMark ?? ".", group = mark === "," ? "." : ",";
  if (!o.thousands && mark === ".") return s;
  // exponents (2^10000, 1e12345) are left ungrouped
  return s.replace(/(?<![\d.]|\^|\d[eE][+\-−]?)(\d+)(\.\d*)?/g, (_m, i: string, f?: string) => {
    const ip = o.thousands ? i.replace(/\B(?=(\d{3})+$)/g, group) : i;
    return ip + (f ? mark + f.slice(1) : "");
  });
}

/** A stored value (an answer, memory, a variable) short enough to keep on the device: past `max` characters (an exact
 *  answer of thousands of digits) it is kept rounded to 30 digits and marked approximate, never left out */
export function storable(s: string, max = 2000): string {
  if (s.length <= max) return s;
  const v = parseStored(s);
  return "f" in v || "m" in v ? exactText(v) : approxText("q" in v ? v.q : v.a, "q" in v ? APPROX_DIGITS : v.p);
}
