// Programming mode: whole numbers in binary, octal, decimal or hexadecimal, with a word size and bitwise operators,
// modelled on GNOME's calculator. Separate from evaluate.ts on purpose: here every value is a BigInt (no fractions, no
// approximations), bare digits are read in the chosen base (FF in hex mode), and the bit operators need a word size.
//
// What follows GNOME:
// - Arithmetic (+ − × ÷ mod, shifts) is worked out in full, and only the answer must fit the word: a bitwise operator
//   with an operand that doesn't fit, or an answer that doesn't, is "Overflow. Try a bigger word size" (no silent wrap).
// - Unsigned (GNOME's only way): the bitwise operators take non-negative numbers ("Bitwise AND is only defined for
//   non-negative integers"); NOT, NAND, NOR, XNOR and the complements work within the word (NOT 0 = FF in 8 bits).
// - mod: the sign follows the divisor. ÷ is whole-number division, rounding towards zero (7 ÷ 2 = 3, −7 ÷ 2 = −3).
// What GNOME doesn't have:
// - Signed numbers (two's complement): the operands are bit patterns of the word, so −1 AND 0F = 15; a non-decimal
//   number with the top bit set reads as negative (FF is −1 in 8 bits), and a negative answer in binary, octal or hex is
//   shown as its bit pattern, so it reads back as the same number.
// - rol / ror (rotate within the word), ** (power), and C's & | ^ ~ as other spellings of AND OR XOR NOT.
// Number literals: digits in the chosen base, a subscript base (1010₂, 777₈, 99₁₀, FF₁₆) or a prefix: 0x and 0o always,
// 0b except in hex mode (where 0B1 is the hex number B1).
import { CalcError, bitLength } from "./rational";

export type Base = 2 | 8 | 10 | 16;
export type WordSize = 8 | 16 | 32 | 64;
export interface ProgOptions {
  base: Base;
  wordSize: WordSize;
  /** two's complement numbers (−2^(w−1) … 2^(w−1)−1) instead of 0 … 2^w−1 */
  signed: boolean;
  /** the previous answer, as a decimal whole number ("-5"), reachable as "ans" */
  ans?: string;
}
/** value: the answer in the chosen base (no subscript), exact: the answer in decimal, to keep as ans or in memory */
export type ProgResult = { value: string; exact: string } | { error: string };

export const BASES: { base: Base; label: string; name: string; sub: string }[] = [
  { base: 16, label: "HEX", name: "hexadecimal", sub: "₁₆" },
  { base: 10, label: "DEC", name: "decimal", sub: "₁₀" },
  { base: 8, label: "OCT", name: "octal", sub: "₈" },
  { base: 2, label: "BIN", name: "binary", sub: "₂" },
];
export const WORD_SIZES: WordSize[] = [8, 16, 32, 64];

const OVERFLOW = "Overflow. Try a bigger word size";
/** No number on the way to the answer gets bigger than this: the answer fits in 64 bits, so 2**100000 can't stall */
const MAX_WORK_BITS = 4096;
const SUB = "₀₁₂₃₄₅₆₇₈₉";

const word = (o: ProgOptions) => {
  const w = BigInt(o.wordSize), size = 1n << w, half = size >> 1n;
  return { w, size, mask: size - 1n, half, min: o.signed ? -half : 0n, max: o.signed ? half - 1n : size - 1n };
};
/** Does the value fit the word (and the sign setting)? */
export const fitsWord = (v: bigint, o: ProgOptions) => { const r = word(o); return v >= r.min && v <= r.max; };
/** The word's bits for a value that fits: two's complement for a negative one */
export const toWord = (v: bigint, o: ProgOptions) => v & word(o).mask;
/** The value a word's bits stand for: negative with the top bit set when signed */
export const fromWord = (u: bigint, o: ProgOptions) => { const r = word(o); u &= r.mask; return o.signed && u >= r.half ? u - r.size : u; };
/** A value with one bit of its word flipped (the bit view) */
export const toggleBit = (v: bigint, bit: number, o: ProgOptions) => fromWord(toWord(v, o) ^ (1n << BigInt(bit)), o);

/** The value written in a base: decimal with its sign, the others as the word's bits (a negative one as its pattern) */
export function formatInt(v: bigint, base: Base, o: ProgOptions): string {
  if (base === 10 || v >= 0n) return v.toString(base).toUpperCase();
  return toWord(v, o).toString(base).toUpperCase();
}
/** Digits in groups from the right (binary in fours, decimal in threes), for reading long numbers */
export function groupDigits(s: string, n: number, sep = " "): string {
  const neg = s.startsWith("-") ? "-" : "", d = neg ? s.slice(1) : s;
  let out = "";
  for (let i = d.length; i > 0; i -= n) out = d.slice(Math.max(0, i - n), i) + (out ? sep + out : "");
  return neg + out;
}
/** A value as it is typed into an expression in the chosen base (a negative decimal one in brackets) */
export function literal(v: bigint, o: ProgOptions): string {
  const s = formatInt(v, o.base, o);
  return s.startsWith("-") ? `(−${s.slice(1)})` : s;
}

type Tok =
  | { t: "num"; v: bigint; bare: boolean; from: number; to: number }
  | { t: "op"; v: string }
  | { t: "name"; v: string };

const KEYWORDS: Record<string, string> = {
  and: "AND", or: "OR", xor: "XOR", nand: "NAND", nor: "NOR", xnor: "XNOR", nxor: "XNOR", not: "NOT", mod: "mod",
  rol: "rol", ror: "ror", shl: "<<", shr: ">>",
};
const NAMES = new Set(["ans", "ones", "twos"]);
const SYMBOLS: [string, string][] = [
  ["<<", "<<"], [">>", ">>"], ["**", "**"], ["+", "+"], ["-", "-"], ["−", "-"], ["*", "*"], ["×", "*"], ["/", "/"], ["÷", "/"],
  ["(", "("], [")", ")"], ["~", "NOT"], ["¬", "NOT"], ["&", "AND"], ["∧", "AND"], ["|", "OR"], ["∨", "OR"], ["^", "XOR"],
  ["⊻", "XOR"], ["%", "mod"], [";", ";"], [",", ";"],
];

const digitsIn = (s: string, base: Base) => (base === 16 ? /^[0-9a-f]+$/i : base === 10 ? /^\d+$/ : base === 8 ? /^[0-7]+$/ : /^[01]+$/).test(s);
const readDigits = (s: string, base: Base) => BigInt((base === 16 ? "0x" : base === 8 ? "0o" : base === 2 ? "0b" : "") + s);
const baseName = (b: Base) => (b === 8 ? "an " : "a ") + BASES.find((x) => x.base === b)!.name;

function tokenize(src: string, o: ProgOptions): Tok[] {
  const out: Tok[] = [];
  const r = word(o);
  // a number written in another base than decimal is a bit pattern: with the top bit set it is negative when signed
  const num = (v: bigint, base: Base, bare: boolean, from: number, to: number) =>
    out.push({ t: "num", v: o.signed && base !== 10 && v >= r.half && v <= r.mask ? v - r.size : v, bare, from, to });
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "." || c === "≈") throw new CalcError("Programming mode works with whole numbers");
    const m = /^[0-9A-Za-z_]+/.exec(src.slice(i));
    if (m) {
      const w = m[0], start = i;
      i += w.length;
      const kw = KEYWORDS[w.toLowerCase()];
      if (kw) { out.push({ t: "op", v: kw }); continue; }
      if (NAMES.has(w.toLowerCase())) { out.push({ t: "name", v: w.toLowerCase() }); continue; }
      let sub = "";
      while (i < src.length && SUB.includes(src[i]!)) sub += SUB.indexOf(src[i++]!);
      if (sub) { // 1010₂, FF₁₆
        const b = Number(sub);
        if (b !== 2 && b !== 8 && b !== 10 && b !== 16) throw new CalcError(`Base ${b} isn't one of 2, 8, 10 and 16`);
        if (!digitsIn(w, b)) throw new CalcError(`${w} is not ${baseName(b)} number`);
        num(readDigits(w, b), b, false, start, i); continue;
      }
      const pre = /^0([xob])(.*)$/i.exec(w);
      if (pre && (pre[1]!.toLowerCase() !== "b" || o.base !== 16)) {
        const b: Base = pre[1]!.toLowerCase() === "x" ? 16 : pre[1]!.toLowerCase() === "o" ? 8 : 2;
        if (!pre[2] || !digitsIn(pre[2], b)) throw new CalcError(`${w} is not ${baseName(b)} number`);
        num(readDigits(pre[2], b), b, false, start, i); continue;
      }
      if (digitsIn(w, o.base)) { num(readDigits(w, o.base), o.base, true, start, i); continue; }
      if (/^[0-9a-f]+$/i.test(w)) throw new CalcError(`${w} is not ${baseName(o.base)} number`);
      throw new CalcError(`Unknown variable ${w}`);
    }
    const s = SYMBOLS.find(([k]) => src.startsWith(k, i));
    if (!s) throw new CalcError("Malformed expression");
    out.push({ t: "op", v: s[1] }); i += s[0].length;
  }
  return out;
}

const OP_NAME: Record<string, string> = {
  AND: "Bitwise AND", OR: "Bitwise OR", XOR: "Bitwise XOR", NAND: "Bitwise NAND", NOR: "Bitwise NOR", XNOR: "Bitwise XNOR",
  NOT: "Bitwise NOT", ones: "Ones' complement", twos: "Two's complement", rol: "Rotation", ror: "Rotation",
};

function run(src: string, o: ProgOptions): bigint {
  const toks = tokenize(src, o);
  if (!toks.length) throw new CalcError("Malformed expression");
  const r = word(o);
  let p = 0, depth = 0;
  const isOp = (...v: string[]) => { const t = toks[p]; return !!t && t.t === "op" && v.includes(t.v); };
  const big = (x: bigint) => { if (x !== 0n && bitLength(x) > MAX_WORK_BITS) throw new CalcError(OVERFLOW); return x; };
  // a bitwise operand: whole word only, and not negative unless signed (GNOME's messages)
  const bits = (x: bigint, op: string) => {
    if (!o.signed && x < 0n) throw new CalcError(`${OP_NAME[op]} is only defined for non-negative integers`);
    if (x < r.min || x > r.max) throw new CalcError(OVERFLOW);
    return x & r.mask;
  };
  const shift = (x: bigint, n: bigint) => {
    if (x === 0n) return 0n;
    if (n < 0n) return x >> -n; // right: rounds down, like C's >> on a signed number
    if (n > BigInt(MAX_WORK_BITS)) throw new CalcError(OVERFLOW);
    return big(x << n);
  };
  const rotate = (x: bigint, n: bigint, op: string) => {
    const u = bits(x, op), k = ((n % r.w) + r.w) % r.w;
    return fromWord((u << k) | (u >> (r.w - k)), o);
  };

  // lowest first: OR NOR, then XOR XNOR, then AND NAND, then shifts, + −, × ÷ mod, unary, ** (C's order for the bits)
  function or(): bigint {
    let a = xor();
    while (isOp("OR", "NOR")) {
      const op = (toks[p++] as { v: string }).v, x = bits(a, op), y = bits(xor(), op);
      a = fromWord(op === "OR" ? x | y : ~(x | y), o);
    }
    return a;
  }
  function xor(): bigint {
    let a = and();
    while (isOp("XOR", "XNOR")) {
      const op = (toks[p++] as { v: string }).v, x = bits(a, op), y = bits(and(), op);
      a = fromWord(op === "XOR" ? x ^ y : ~(x ^ y), o);
    }
    return a;
  }
  function and(): bigint {
    let a = shifts();
    while (isOp("AND", "NAND")) {
      const op = (toks[p++] as { v: string }).v, x = bits(a, op), y = bits(shifts(), op);
      a = fromWord(op === "AND" ? x & y : ~(x & y), o);
    }
    return a;
  }
  function shifts(): bigint {
    let a = sum();
    while (isOp("<<", ">>", "rol", "ror")) {
      const op = (toks[p++] as { v: string }).v, n = sum();
      a = op === "<<" ? shift(a, n) : op === ">>" ? shift(a, -n) : rotate(a, op === "rol" ? n : -n, op);
    }
    return a;
  }
  function sum(): bigint {
    let a = product();
    while (isOp("+", "-")) { const op = (toks[p++] as { v: string }).v, b = product(); a = big(op === "+" ? a + b : a - b); }
    return a;
  }
  function product(): bigint {
    let a = unary();
    for (;;) {
      if (isOp("*")) { p++; a = big(a * unary()); }
      else if (isOp("/", "mod")) {
        const op = (toks[p++] as { v: string }).v, b = unary();
        if (b === 0n) throw new CalcError("Division by zero");
        if (op === "/") a /= b;
        else { const m = a % b; a = m !== 0n && (m < 0n) !== (b < 0n) ? m + b : m; } // the sign follows the divisor
      } else if (isOp("(") || (toks[p - 1]?.t === "op" && (toks[p - 1] as { v: string }).v === ")" && (toks[p]?.t === "num" || toks[p]?.t === "name"))) {
        a = big(a * unary()); // 2(3), (1)(2), (2)3
      } else return a;
    }
  }
  function unary(): bigint {
    if (isOp("-")) { p++; return -unary(); }
    if (isOp("+")) { p++; return unary(); }
    if (isOp("NOT")) { p++; return fromWord(~bits(unary(), "NOT"), o); }
    return power();
  }
  function power(): bigint {
    const a = atom();
    if (!isOp("**")) return a;
    p++;
    const b = unary();
    if (b < 0n) throw new CalcError("A negative power isn't a whole number");
    if (a === 0n || a === 1n) return b === 0n ? 1n : a;
    if (a === -1n) return b % 2n ? -1n : 1n;
    if (b > BigInt(MAX_WORK_BITS)) throw new CalcError(OVERFLOW);
    return big(a ** b);
  }
  function bracketed(): bigint {
    p++; depth++;
    const a = or();
    depth--;
    if (isOp(")")) p++; // a bracket left open at the end is closed for you
    else if (p < toks.length) throw new CalcError("Malformed expression");
    return a;
  }
  function atom(): bigint {
    const t = toks[p];
    if (!t) throw new CalcError("Malformed expression");
    if (t.t === "num") { p++; return t.v; }
    if (t.t === "name") {
      p++;
      if (t.v === "ans") {
        const s = o.ans || "0";
        if (!/^-?\d+$/.test(s)) throw new CalcError("ans is not a whole number");
        return BigInt(s);
      }
      // ones(x), twos(x), or without brackets: ones 5
      const x = bits(isOp("(") ? bracketed() : unary(), t.v);
      return fromWord(t.v === "ones" ? ~x : -x, o);
    }
    if (t.v === "(") return bracketed();
    throw new CalcError(t.v === ")" && depth === 0 ? "Too many closing brackets" : "Malformed expression");
  }

  const v = or();
  if (p < toks.length) throw new CalcError(isOp(")") ? "Too many closing brackets" : "Malformed expression");
  return v;
}

/** Works out an expression in programming mode */
export function evaluateProgramming(expression: string, o: ProgOptions): ProgResult {
  try {
    const v = run(expression, o);
    if (v < 0n && !o.signed) return { error: "Below zero: turn on Signed for negative numbers" };
    if (!fitsWord(v, o)) return { error: OVERFLOW };
    return { value: formatInt(v, o.base, o), exact: v.toString() };
  } catch (e) {
    if (e instanceof CalcError) return { error: e.message };
    if (e instanceof RangeError) return { error: OVERFLOW };
    return { error: "Malformed expression" };
  }
}

/** The expression with its plain numbers rewritten from one base into another (switching base while typing), so it
 *  still means the same. Numbers with their own base (0x1F, 101₂), operators and names are left as they are. Each word
 *  is read on its own, so a sum that isn't finished or has a mistake in it (12 + 0x) still has all its numbers moved. */
export function rebase(expression: string, from: ProgOptions, to: Base): string {
  const r = word(from), target = { ...from, base: to };
  return expression.replace(/[0-9A-Za-z_]+[₀-₉]*/g, (w) => {
    let toks: Tok[];
    try { toks = tokenize(w, from); } catch { return w; }
    const t = toks[0];
    if (toks.length !== 1 || !t || t.t !== "num") return w;
    // 0b101 would be the hex number B101 in hex mode: written with its base as a subscript instead
    if (!t.bare) return to === 16 && /^0b/i.test(w) ? w.slice(2) + "₂" : w;
    // signed: a non-decimal number with the top bit set is a bit pattern that reads as negative, so a bigger decimal
    // number (128 in 8 bits, fine on the way to 128 − 1) keeps its value written in decimal with its base
    if (from.signed && to !== 10 && t.v >= r.half && t.v <= r.mask) return t.v.toString() + "₁₀";
    return literal(t.v, target);
  });
}
