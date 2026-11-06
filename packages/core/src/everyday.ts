// Everyday helpers (Calculator's Everyday mode, loaded only when chosen and switched on in Settings): percentages,
// discounts, tips and splitting a bill, VAT. Everything is worked out exactly (rationals, so 19.99 × 3 is 59.97, never
// 59.970000000000006); only the text shown is rounded, money to 2 decimals, with `rounded` saying when that hid digits.
// Fields take whole expressions ("12.50 + 8.20"), read with the user's decimal mark like a paste into the calculator.
import { type Q, q, add, sub, mul, div, neg, cmp, isInt, floor, toFixed, parseDecimal, ZERO, ONE } from "./rational";
import { evaluate } from "./evaluate";
import { asQ, parseStored } from "./format";
import { sanitizeInput } from "./input";

export type Fail = { error: string };
export type Res<T> = T | Fail;
export const failed = <T extends object>(r: Res<T> | null): r is Fail => !!r && "error" in r;

// a literal, not q(100n): a call at the top level would keep this module in the first screen's bundle (not tree-shaken)
const HUNDRED: Q = { n: 100n, d: 1n };
const pct = (p: Q) => div(p, HUNDRED);
const isNeg = (a: Q) => a.n < 0n;
const isZero = (a: Q) => a.n === 0n;

/** A field's text as a number: null when empty, an error when it can't be worked out. A percent field may end in "%"
 *  ("15%" is 15, not 0.15). approx: the expression had something inexact in it (√2, π), so the answer is too. */
export function readNumber(text: string, decimalMark: "." | "," = ".", percent = false): { q: Q; approx: boolean } | Fail | null {
  let s = sanitizeInput(text, decimalMark);
  if (percent) s = s.replace(/\s*%\s*$/, "");
  if (!s) return null;
  const r = evaluate(s);
  if ("error" in r) return { error: r.error };
  if (r.assigned) return { error: "Malformed expression" };
  return { q: asQ(parseStored(r.exact)), approx: r.exact.startsWith("≈") };
}

/** a rounded to 2 decimals (half away from zero), exactly */
export const round2 = (a: Q): Q => parseDecimal(toFixed(a, 2));
/** a rounded up to a whole number */
export const ceilQ = (a: Q): Q => q(-floor(neg(a)));

/** Money as text: always 2 decimals ("12.50", "-3.00"), "." as the decimal mark; rounded when that hid digits */
export function money(a: Q): { text: string; rounded: boolean } {
  const r = round2(a), t = toFixed(r, 2);
  const [i, f = ""] = t.split(".");
  return { text: `${i}.${f.padEnd(2, "0")}`, rounded: cmp(r, a) !== 0 };
}
/** A plain number (a percentage, a count) as text, to `places` decimals with trailing zeros dropped */
export function plain(a: Q, places = 4): { text: string; rounded: boolean } {
  const t = toFixed(a, places);
  return { text: t, rounded: cmp(parseDecimal(t), a) !== 0 };
}

// ---- Percent ----
/** X% of Y */
export const percentOf = (x: Q, y: Q): Q => mul(pct(x), y);
/** X is what % of Y */
export const whatPercent = (x: Q, y: Q): Res<Q> => (isZero(y) ? { error: "Nothing is a percentage of 0" } : mul(div(x, y), HUNDRED));
/** The change from A to B, as a percentage of A, and as a difference */
export function percentChange(a: Q, b: Q): Res<{ percent: Q; diff: Q; up: boolean; down: boolean }> {
  if (isZero(a)) return { error: "A change from 0 has no percentage" };
  const diff = sub(b, a), percent = mul(div(diff, a.n < 0n ? neg(a) : a), HUNDRED);
  return { percent, diff, up: cmp(diff, ZERO) > 0, down: cmp(diff, ZERO) < 0 };
}
/** A plus X% (sign 1) or minus X% (sign -1): the result and the part added or taken away */
export function addPercent(a: Q, x: Q, sign: 1 | -1 = 1): { result: Q; part: Q } {
  const part = mul(a, pct(x));
  return { result: sign === 1 ? add(a, part) : sub(a, part), part };
}

// ---- Discount ----
/** A price after one or more discounts in turn (20% then 10% is 28% off, not 30%), then an amount off.
 *  saving: price - sale; percent: the saving as a share of the price. */
export function discount(price: Q, percents: Q[], amountOff: Q | null = null): Res<{ sale: Q; saving: Q; percent: Q }> {
  if (isNeg(price)) return { error: "Use a price of 0 or more" };
  let sale = price;
  for (const p of percents) {
    if (isNeg(p) || cmp(p, HUNDRED) > 0) return { error: "A discount is between 0% and 100%" };
    sale = mul(sale, sub(ONE, pct(p)));
  }
  if (amountOff) {
    if (isNeg(amountOff)) return { error: "Use an amount off of 0 or more" };
    sale = sub(sale, amountOff);
    if (isNeg(sale)) return { error: "The discount is more than the price" };
  }
  const saving = sub(price, sale);
  return { sale, saving, percent: isZero(price) ? ZERO : mul(div(saving, price), HUNDRED) };
}

// ---- Tip and split ----
export interface TipSplit {
  tip: Q; total: Q; perPerson: Q;
  /** rounding each share up to a whole number: what that adds to the total (0 when not rounding up) */
  extra: Q;
  /** each share shown to the cent: how far those shares together are from the total (0 when they add up) */
  uneven: Q;
  /** and whether they come to more than the total (else less) */
  over: boolean;
}
/** The tip on a bill, the total, and each person's share; roundUp makes each share a whole number (up), the extra
 *  going to the tip */
export function tipSplit(bill: Q, tipPercent: Q, people: Q = ONE, roundUp = false): Res<TipSplit> {
  if (isNeg(bill)) return { error: "Use a bill of 0 or more" };
  if (isNeg(tipPercent)) return { error: "Use a tip of 0% or more" };
  if (!isInt(people) || people.n < 1n) return { error: "People is a whole number, 1 or more" };
  const total = add(bill, mul(bill, pct(tipPercent)));
  let per = div(total, people), extra = ZERO, t = total;
  if (roundUp) { per = ceilQ(per); t = mul(per, people); extra = sub(t, total); }
  const gap = sub(mul(round2(per), people), t);
  return { tip: sub(t, bill), total: t, perPerson: per, extra, uneven: isNeg(gap) ? neg(gap) : gap, over: cmp(gap, ZERO) > 0 };
}

// ---- VAT ----
/** VAT at `rate`%: "add" reads the amount as net (before VAT), "remove" as gross (VAT included) */
export function vat(amount: Q, rate: Q, mode: "add" | "remove"): Res<{ net: Q; vat: Q; gross: Q }> {
  if (isNeg(rate)) return { error: "Use a rate of 0% or more" };
  const f = add(ONE, pct(rate));
  const net = mode === "add" ? amount : div(amount, f), gross = mode === "add" ? mul(amount, f) : amount;
  return { net, vat: sub(gross, net), gross };
}
