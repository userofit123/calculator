// A minimal evaluator so the calculator screen is usable now: + - × ÷ (also * and /), brackets, unary minus and
// decimals. The full engine (functions, precedence extras, modes) replaces the inside later; the interface stays.
// Numbers are exact fractions of big integers, so 0.1 + 0.2 is 0.3 and nothing drifts until the final rounding.

export interface EvalOptions {
  /** Digits after the decimal point in the answer (rounded half away from zero, trailing zeros dropped). Default 12. */
  decimals?: number;
}
export type EvalResult = { value: string } | { error: string };

interface Q { n: bigint; d: bigint } // n / d, d > 0, always reduced

const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d: bigint = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => { if (b.n === 0n) throw new CalcError("Can't divide by zero"); return q(a.n * b.d, a.d * b.n); };

class CalcError extends Error {}

function parseNumber(s: string): Q {
  const [i = "", f = ""] = s.split(".");
  return q(BigInt((i || "0") + f), 10n ** BigInt(f.length));
}

/** The answer as text: rounded to `decimals` places, no trailing zeros, "-0" shown as "0". */
export function formatQ(x: Q, decimals = 12): string {
  const neg = x.n < 0n, n = neg ? -x.n : x.n, scale = 10n ** BigInt(decimals);
  const r = (n * scale * 2n + x.d) / (x.d * 2n); // rounded half up on the absolute value
  const ip = r / scale, fp = (r % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  const out = ip.toString() + (fp ? "." + fp : "");
  return neg && out !== "0" ? "-" + out : out;
}

// expr := term (("+" | "-") term)* ; term := unary (("*" | "/") unary)* ; unary := "-" unary | "+" unary | atom
// atom := number | "(" expr ")"
function parse(src: string): Q {
  const t = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/\s+/g, "");
  let i = 0;
  const peek = () => t[i];
  const expr = (): Q => {
    let v = term();
    while (peek() === "+" || peek() === "-") { const op = t[i++]; v = op === "+" ? add(v, term()) : sub(v, term()); }
    return v;
  };
  const term = (): Q => {
    let v = unary();
    while (peek() === "*" || peek() === "/") { const op = t[i++]; v = op === "*" ? mul(v, unary()) : div(v, unary()); }
    return v;
  };
  const unary = (): Q => {
    if (peek() === "-") { i++; return mul(q(-1n), unary()); }
    if (peek() === "+") { i++; return unary(); }
    return atom();
  };
  const atom = (): Q => {
    if (peek() === "(") {
      i++; const v = expr();
      if (peek() === ")") i++; // a bracket left open at the end is closed for you, as on a phone calculator
      else if (i < t.length) throw new CalcError("Check the brackets");
      return v;
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(t.slice(i));
    if (!m) throw new CalcError(i >= t.length ? "Incomplete expression" : "Can't read this");
    i += m[0].length;
    return parseNumber(m[0]);
  };
  if (!t) throw new CalcError("Empty");
  const v = expr();
  if (i < t.length) throw new CalcError(t[i] === ")" ? "Check the brackets" : "Can't read this");
  return v;
}

export function evaluate(expression: string, options: EvalOptions = {}): EvalResult {
  try { return { value: formatQ(parse(expression), options.decimals ?? 12) }; }
  catch (e) { return { error: e instanceof CalcError ? e.message : "Can't work this out" }; }
}
