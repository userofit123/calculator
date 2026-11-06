// Numbers as the user sees them. A value is an exact fraction or, after an irrational step, a double; doubles are
// rounded to 15 significant digits first, which hides float noise (0.30000000000000004, sin 30° = 0.49999999999999994)
// while keeping every digit a double can be trusted with.
import { type Q, CalcError, exponent10, parseDecimal, toFixed, isInt, q } from "./rational";

export type Value = { q: Q } | { f: number };
export type NumberFormat = "auto" | "fixed" | "sci" | "eng";

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
export const asQ = (v: Value): Q => ("q" in v ? v.q : cleanFloat(v.f));

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
  const places = Math.max(0, Math.min(30, o.decimals ?? 12)), fmt = o.format ?? "auto";
  const a = asQ(v);
  if (a.n === 0n) return "0";
  if (fmt === "fixed") return toFixed(a, places);
  if (fmt === "sci" || fmt === "eng") return sci(a, Math.min(places, 15), fmt === "eng");
  const e = exponent10(a);
  // whole numbers are written out in full while they still fit on a wide screen (2^100 = 1267650600228229401496703205376)
  if (isInt(a) ? e >= 40 : e >= 21) return sci(a, Math.min(places, 15), false);
  const plain = toFixed(a, places);
  // too small to show at this many decimals: switch to ×10ⁿ instead of showing 0
  if (e < -6 || (plain === "0" || plain === "-0")) return sci(a, Math.min(places, 15), false);
  return plain;
}

/** The value in full (a fraction "n/d" or a double's shortest text), for storing an answer, memory or variable */
export function exactText(v: Value): string {
  if ("f" in v) return String(v.f);
  return isInt(v.q) ? v.q.n.toString() : `${v.q.n}/${v.q.d}`;
}
/** Reads back what exactText wrote (also plain decimals) */
export function parseStored(s: string): Value {
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
