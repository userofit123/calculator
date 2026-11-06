// Text → tokens → syntax tree. Accepts what people type on a calculator and on a keyboard: × ÷ − and * / -,
// superscript powers (x², 2⁻¹), √ ∛ and ³√8, |x|, n!, %, implicit multiplication (2π, 3(4), 2sin 30), a bracket left
// open at the end, scientific entry (1.2e5), functions with or without brackets (sin 30, log₂(8), log(8; 2)) and
// "name = expression" to store a variable.
import { CalcError } from "./rational";
import { FINANCIAL_NAMES, financialName } from "./financial";

export type Node =
  | { k: "num"; text: string }
  | { k: "name"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "mod" | "^"; a: Node; b: Node }
  | { k: "pct"; a: Node }
  | { k: "fact"; a: Node }
  | { k: "root"; n: number; a: Node }
  | { k: "call"; f: string; args: Node[] };

export interface Statement { assign?: string; expr: Node }

type Tok =
  | { t: "num"; v: string }
  | { t: "name"; v: string }
  | { t: "sup"; v: string } // a superscript exponent, as plain text ("2", "-1")
  | { t: "op"; v: string };

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", SUB = "₀₁₂₃₄₅₆₇₈₉";
const OPS: Record<string, string> = {
  "+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "·": "*", "⋅": "*", "/": "/", "÷": "/", "∕": "/",
  "^": "^", "(": "(", ")": ")", "|": "|", "!": "!", "%": "%", "=": "=", ";": ";", ",": ";", "√": "√", "∛": "∛", "∜": "∜",
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    // the keyboard and paste turn "-" into "−", so 1.5e−3 is scientific entry too (the e key itself types "×e")
    // "≈" marks a stored approximation (an answer rounded to its trustworthy digits), so it stays approximate when reused
    const ap = c === "≈" ? (/^≈[-−]/.test(src.slice(i)) ? 2 : 1) : 0;
    const num = /^(\d+\.?\d*|\.\d+)(?:[eE][+\-−]?\d+)?/.exec(src.slice(i + ap));
    if (num) { out.push({ t: "num", v: (ap ? (ap === 2 ? "≈-" : "≈") : "") + num[0].replace("−", "-") }); i += ap + num[0].length; continue; }
    if (SUP.includes(c) || c === "⁻" || c === "⁺") {
      let s = "";
      while (i < src.length && (SUP.includes(src[i]!) || src[i] === "⁻" || src[i] === "⁺")) { const ch = src[i++]!; s += ch === "⁻" ? "-" : ch === "⁺" ? "" : String(SUP.indexOf(ch)); }
      if (!/^-?\d+$/.test(s)) throw new CalcError("Malformed expression");
      out.push({ t: "sup", v: s }); continue;
    }
    if (c === "π") { out.push({ t: "name", v: "π" }); i++; continue; }
    if (/\p{L}|_/u.test(c)) {
      let s = "";
      while (i < src.length && (/[\p{L}_]/u.test(src[i]!) || SUB.includes(src[i]!)) && src[i] !== "π") s += src[i++];
      // log2(8), log10(100): the digits are the base, not a number to multiply by
      const base = s === "log" ? /^(\d+)(?=\s*\()/.exec(src.slice(i)) : null;
      if (base) { s += [...base[1]!].map((d) => SUB[Number(d)]).join(""); i += base[1]!.length; }
      out.push({ t: "name", v: s }); continue;
    }
    const op = OPS[c];
    if (!op) throw new CalcError("Malformed expression");
    out.push({ t: "op", v: op }); i++;
  }
  return out;
}

/** Function names (and their other spellings) the parser knows, so "sin 30" is a call and not s·i·n·30 */
export const FUNCTIONS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "arcsin", "arccos", "arctan", "arsinh", "arcosh", "artanh",
  "ln", "log", "exp", "sqrt", "cbrt", "root", "abs", "floor", "ceil", "round", "frac", "int", "sgn", "gamma", "fact",
  ...FINANCIAL_NAMES,
]);
/** A function's name, so it can't be a variable: the financial ones in any case (PMT, Pmt, pmt) */
export const isFunction = (n: string) => FUNCTIONS.has(n) || financialName(n) !== null || /^log[₀-₉]+$/.test(n);

export function parse(src: string): Statement {
  const toks = tokenize(src);
  if (!toks.length) throw new CalcError("Malformed expression");
  // depth: brackets open around the current point, so a ")" with none open is reported as one too many, not as malformed
  let p = 0, absDepth = 0, depth = 0;
  const peek = (o = 0) => toks[p + o];
  const isOp = (v: string, o = 0) => { const t = peek(o); return !!t && t.t === "op" && t.v === v; };
  const isName = (v: string) => { const t = peek(); return !!t && t.t === "name" && t.v === v; };

  // expr := term (("+" | "-") term)*   with GNOME's percentages: a + b% is a + a·b/100
  function expr(): Node {
    let a = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: "+" | "-" }).v;
      const b = term();
      a = b.k === "pct" ? { k: "bin", op: "*", a, b: { k: "bin", op, a: { k: "num", text: "1" }, b } } : { k: "bin", op, a, b };
    }
    return a;
  }
  // can the next token begin an operand (for implicit multiplication: 2π, 3(4), (1)(2), 2sin 30)?
  function startsOperand(prev: Tok | undefined): boolean {
    const t = peek();
    if (!t) return false;
    if (t.t === "num") return prev?.t !== "num"; // "2 3" is a typing slip, not 6
    if (t.t === "name") return t.v !== "mod";
    if (t.t === "sup") return isOp("√", 1);
    return t.v === "(" || t.v === "√" || t.v === "∛" || t.v === "∜" || (t.v === "|" && absDepth === 0);
  }
  // term := unary (("*" | "/" | "mod") unary | implicit unary)*
  function term(): Node {
    let a = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) { const op = (toks[p++] as { v: "*" | "/" }).v; a = { k: "bin", op, a, b: unary() }; }
      else if (isName("mod")) { p++; a = { k: "bin", op: "mod", a, b: unary() }; }
      else if (startsOperand(toks[p - 1])) a = { k: "bin", op: "*", a, b: power() };
      else return a;
    }
  }
  // unary := ("-" | "+") unary | power   (so -2² is -(2²), as written in maths)
  function unary(): Node {
    if (isOp("-")) { p++; return { k: "neg", a: unary() }; }
    if (isOp("+")) { p++; return unary(); }
    return power();
  }
  // power := postfix ("^" unary)?   (right to left: 2^3^2 is 2^9)
  function power(): Node {
    const a = postfix(atom());
    if (isOp("^")) { p++; return { k: "bin", op: "^", a, b: unary() }; }
    return a;
  }
  function postfix(a: Node): Node {
    for (;;) {
      const t = peek();
      if (isOp("!")) { p++; a = { k: "fact", a }; }
      else if (isOp("%")) { p++; a = { k: "pct", a }; }
      else if (t?.t === "sup" && !isOp("√", 1)) { p++; a = { k: "bin", op: "^", a, b: { k: "num", text: t.v } }; }
      else return a;
    }
  }
  function args(): Node[] {
    p++; depth++; // "("
    const list = [expr()];
    while (isOp(";")) { p++; list.push(expr()); }
    depth--;
    if (isOp(")")) p++;
    else if (p < toks.length) throw new CalcError("Malformed expression");
    return list;
  }
  function atom(): Node {
    const t = toks[p];
    if (!t) throw new CalcError("Malformed expression");
    if (t.t === "num") { p++; return { k: "num", text: t.v }; }
    if (t.t === "sup") {
      if (!isOp("√", 1)) throw new CalcError("Malformed expression");
      p += 2;
      return { k: "root", n: Number(t.v), a: postfix(atom()) };
    }
    if (t.t === "op") {
      if (t.v === "(") {
        p++; depth++;
        const a = expr();
        depth--;
        if (isOp(")")) p++; // a bracket left open at the end is closed for you
        else if (p < toks.length) throw new CalcError("Malformed expression");
        return a;
      }
      if (t.v === "|") {
        p++; absDepth++;
        const a = expr();
        absDepth--;
        if (isOp("|")) p++;
        else if (p < toks.length) throw new CalcError("Malformed expression");
        return { k: "call", f: "abs", args: [a] };
      }
      if (t.v === "√" || t.v === "∛" || t.v === "∜") {
        p++;
        return { k: "root", n: t.v === "√" ? 2 : t.v === "∛" ? 3 : 4, a: unaryOperand() };
      }
      throw new CalcError(t.v === ")" && depth === 0 ? "Too many closing brackets" : "Malformed expression");
    }
    // a name: a function, a constant or a variable
    p++;
    if (isFunction(t.v)) {
      // a function name with nothing to work on ("rate", "rate × 2", "(term)"): most likely meant as a variable
      const nx = peek();
      if (!nx || (nx.t === "op" && [")", ";", "+", "*", "/", "="].includes(nx.v)) || (nx.t === "name" && nx.v === "mod")) {
        throw new CalcError(`${t.v} is a built-in name`);
      }
      // sin²(x) is (sin x)², sin⁻¹(x) is asin x
      let f = t.v, sq: Node | null = null;
      const s = peek();
      if (s?.t === "sup") { p++; if (s.v === "-1") f = "inv:" + f; else sq = { k: "num", text: s.v }; }
      const call: Node = { k: "call", f, args: isOp("(") ? args() : [unaryOperand()] };
      return sq ? { k: "bin", op: "^", a: call, b: sq } : call;
    }
    return { k: "name", name: t.v };
  }
  // the operand of √ or of a function written without brackets: √2^2 is (√2)², sin -30 works, sin 30 + 1 is sin(30) + 1
  function unaryOperand(): Node {
    if (isOp("-")) { p++; return { k: "neg", a: unaryOperand() }; }
    return postfix(atom());
  }

  let assign: string | undefined;
  const t0 = toks[0]!;
  if (t0.t === "name" && toks[1]?.t === "op" && toks[1].v === "=") {
    // "rate = 3": a function's name can't be stored to (like ans or π, see RESERVED)
    if (isFunction(t0.v)) throw new CalcError(`Can't change ${t0.v}, it's a built-in name`);
    assign = t0.v; p = 2;
  }
  const e = expr();
  if (p < toks.length) throw new CalcError(isOp(")") ? "Too many closing brackets" : "Malformed expression");
  return { assign, expr: e };
}
