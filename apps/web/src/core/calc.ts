// The calculator's state, kept outside the page so it survives moving to another page and back. The maths is in
// @calc/core; here only the typed text is edited (append, delete, brackets, sign) and handed over to be worked out.
// Memory, variables, the last answer and the calculator settings are kept on this device.
import { reactive, watch } from "vue";
import {
  evaluate, formatDisplay, sanitizeInput, storable, RESERVED, type AngleUnit, type EvalOptions, type EvalResult, type NumberFormat,
  evaluateProgramming, formatInt, fitsWord, literal, rebase, type Base, type WordSize, type ProgOptions,
} from "@calc/core";
import { readJson, writeJson } from "./prefs";
import { addHistory } from "./history";

export type Mode = "basic" | "advanced" | "financial" | "programming";
export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "basic", label: "Basic", hint: "Everyday sums" },
  { id: "advanced", label: "Advanced", hint: "Powers, roots, trigonometry, logarithms" },
  { id: "financial", label: "Financial", hint: "Loans, interest, depreciation" },
  { id: "programming", label: "Programming", hint: "Binary, octal, hex, bit operations" },
];

export interface CalcSettings { angle: AngleUnit; decimals: number; format: NumberFormat; thousands: boolean; decimalMark: "." | "," }
export const settings = reactive<CalcSettings>({ angle: "deg", decimals: 10, format: "auto", thousands: false, decimalMark: ".", ...readJson<Partial<CalcSettings>>("calcSettings", {}) });
watch(settings, (s) => writeJson("calcSettings", s), { deep: true });
export const ANGLES: { id: AngleUnit; label: string }[] = [{ id: "deg", label: "DEG" }, { id: "rad", label: "RAD" }, { id: "grad", label: "GRAD" }];

export const calc = reactive({
  mode: readJson<Mode>("calcMode", "basic"),
  expr: "",
  /** the answer after = as shown (decimal "."), or "" while typing */
  answer: "",
  error: "",
  /** the last answer in full ("1/3"), reachable as ans */
  ans: readJson<string>("calcAns", ""),
  /** memory in full, "" when empty */
  mem: readJson<string>("calcMem", ""),
  vars: readJson<Record<string, string>>("calcVars", {}),
  /** advanced keys: the 2nd layer (inverse functions) and hyperbolic functions */
  second: false,
  hyp: false,
});
watch(() => calc.mode, (m) => writeJson("calcMode", m));
// answers of thousands of digits are kept in full only until the app closes, so they can't fill the device's storage:
// on the device they are kept to 30 digits, marked approximate (never left out, so ans + 1 still means something)
watch(() => calc.ans, (v) => writeJson("calcAns", storable(v)));
watch(() => calc.mem, (v) => writeJson("calcMem", storable(v)));
watch(() => calc.vars, (v) => writeJson("calcVars", Object.fromEntries(Object.entries(v).map(([k, x]) => [k, storable(x)]))), { deep: true });

const evalOptions = (): EvalOptions => ({ angle: settings.angle, decimals: settings.decimals, format: settings.format, variables: calc.vars, ans: calc.ans });
/** Text as shown: the chosen decimal mark and thousands grouping */
export const show = (s: string) => formatDisplay(s, settings);

// Programming mode: the base digits are typed and shown in, the word size and signed numbers (see core/programming.ts).
// The answer is kept in decimal (calc.ans), so changing base or word size shows the same number differently.
export interface ProgSettings { base: Base; wordSize: WordSize; signed: boolean }
export const prog = reactive<ProgSettings>({ base: 10, wordSize: 64, signed: false, ...readJson<Partial<ProgSettings>>("calcProg", {}) });
watch(prog, (s) => writeJson("calcProg", s), { deep: true });
const isProg = () => calc.mode === "programming";
const progOptions = (): ProgOptions => ({ ...prog, ans: calc.ans });
/** Works out the expression in the current mode */
const run = (expr: string, maxBits?: number) => (isProg() ? evaluateProgramming(expr, progOptions()) : evaluate(expr, { ...evalOptions(), maxBits }));
/** Text of the display as shown: programming mode has no decimal mark or grouping (hex digits aren't decimal ones) */
export const showCalc = (s: string) => (isProg() ? s.replace(/-/g, "−") : show(s));
/** The value on the display in programming mode (the answer, or what = would give now), for the bases and the bits */
export function progValue(): bigint | null {
  if (calc.error) return null;
  if (calc.answer) return /^-?\d+$/.test(calc.ans) ? BigInt(calc.ans) : null;
  if (!calc.expr) return 0n;
  const r = evaluateProgramming(calc.expr, progOptions());
  return "exact" in r ? BigInt(r.exact) : null;
}
/** Shows another number (a bit flipped in the bit view): typed in as a new sum in the current base */
export function setProgValue(v: bigint) { calc.expr = literal(v, prog); calc.answer = ""; calc.error = ""; }
/** Changes base; a sum being typed has its numbers rewritten, so it keeps its meaning */
export function setBase(b: Base) {
  if (!calc.answer && !calc.error && calc.expr) calc.expr = rebase(calc.expr, progOptions(), b);
  prog.base = b;
}
// the answer on the display follows the base, word size and sign; one that no longer fits is an overflow
watch(prog, () => {
  if (!isProg() || !calc.answer || !/^-?\d+$/.test(calc.ans)) return;
  const v = BigInt(calc.ans);
  if (fitsWord(v, prog)) calc.answer = formatInt(v, prog.base, prog);
  else { calc.answer = ""; calc.error = "Overflow. Try a bigger word size"; }
}, { deep: true });
const HEX = "0123456789ABCDEF";
/** Is the key a digit of the current base (0-1, 0-7, 0-9, 0-F)? */
const progDigit = (k: string) => k.length === 1 && HEX.indexOf(k) >= 0 && HEX.indexOf(k) < prog.base;

const OPS = ["+", "−", "×", "÷"];
const last = () => calc.expr.slice(-1);
const isOp = (c: string) => OPS.includes(c);
/** The number being typed at the end of the expression ("" if none) */
const tailNumber = () => (isProg() ? /([\dA-F]*)$/ : /(\d*\.?\d*)$/).exec(calc.expr)?.[1] ?? "";
const open = () => (calc.expr.match(/\(/g)?.length ?? 0) - (calc.expr.match(/\)/g)?.length ?? 0);
// ends with something an operator can follow: a number, ")", a postfix (! % ²), a constant or a variable
const endsOperand = () => /[\d.)!%²³¹⁰-⁹|\p{L}_₀-₉]$/u.test(calc.expr);

// The preview is worked out on every key press, so it only takes numbers up to about 33,000 digits: anything bigger
// waits for = (which may take a moment), and typing never stalls
const PREVIEW_BITS = 110_000;
/** What = would give now, shown faintly under the expression while typing ("" when it isn't complete yet) */
export function preview(): string {
  if (!calc.expr || calc.answer || calc.error) return "";
  const r = run(calc.expr, PREVIEW_BITS);
  if (!("value" in r)) return r.error === "Number is too large" ? r.error : ""; // 2^1000000: no point pressing =
  return r.value !== calc.expr ? r.value : "";
}
/** The answer, or what = would give now, in full (for copying, M+, saving as a variable) */
export function current(): { value: string; exact: string } | null {
  if (calc.answer) return { value: calc.answer, exact: calc.ans };
  if (!calc.expr) return null;
  const r = run(calc.expr);
  return "value" in r ? r : null;
}

// After =, a number or function starts afresh and an operator carries on from the answer: written out when the
// shown answer is the whole answer, else as "ans" (so 1 ÷ 3 = then × 3 gives exactly 1). After an error the sum stays
// as it was, to be put right (like GNOME's calculator).
function fromAnswer(keepAnswer: boolean) {
  if (calc.error) { calc.error = ""; return; }
  if (!calc.answer) return;
  if (keepAnswer && isProg()) calc.expr = /^-?\d+$/.test(calc.ans) ? literal(BigInt(calc.ans), prog) : "ans";
  else if (keepAnswer) {
    const r = evaluate(calc.answer);
    calc.expr = "value" in r && r.exact === calc.ans ? calc.answer.replace(/^-/, "−") : "ans";
  } else calc.expr = "";
  calc.answer = ""; calc.error = "";
}

/** Adds an operand (a number, a function, a constant): after an answer it starts afresh */
function operand(s: string) {
  fromAnswer(false);
  // 2 then the e key is 2×e: "2e−3" would read as 2×10⁻³ (a letter e typed on the keyboard is scientific entry, see press)
  if (/[\d.]$/.test(calc.expr) && (/^[\d.≈]/.test(s) || /^e(?![\p{L}])/u.test(s))) calc.expr += "×";
  // 5 then NOT or ans: 5×NOT …, never one word "5NOT"
  else if (isProg() && /[\dA-Za-z)]$/.test(calc.expr) && /^[\p{L}\d(]/u.test(s)) calc.expr += "×";
  calc.expr += s;
}
/** Adds something that works on what comes before (x², n!, ^, mod): after an answer it carries on from it */
function after(s: string) {
  fromAnswer(true);
  if (!calc.expr || !endsOperand()) return;
  calc.expr += s;
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** M+ and M−: memory = memory ± the answer (worked out by the core, in full) */
function memAdd(sign: "+" | "−") {
  const c = current();
  if (!c) return;
  const r = evaluate(`(${calc.mem || "0"})${sign}(${c.exact})`);
  if ("value" in r) calc.mem = r.exact === "0" ? "" : r.exact;
}
/** A stored value (an answer in full, memory) typed into the sum without losing anything: 1/3 is (1÷3) */
export function typedValue(exact: string): string {
  if (isProg() && /^-?\d+$/.test(exact)) return literal(BigInt(exact), prog);
  const m = /^(-?)(\d+)\/(\d+)$/.exec(exact);
  return m ? `(${m[1] ? "−" : ""}${m[2]}÷${m[3]})` : exact.replace(/-/g, "−");
}
/** A stored value as it is shown: rounded like an answer */
export function valueText(exact: string): string {
  const r = evaluate(exact, { decimals: settings.decimals, format: settings.format });
  return "value" in r ? r.value : exact;
}

export function press(k: string) {
  if (isProg() && progPress(k)) return;
  if (k === "AC") { calc.expr = ""; calc.answer = ""; calc.error = ""; return; }
  if (k === "C") { // clears the number being typed; with nothing to clear, everything
    if (calc.answer || calc.error || !tailNumber() || calc.expr === tailNumber()) return press("AC");
    calc.expr = calc.expr.slice(0, -tailNumber().length); return;
  }
  if (k === "⌫") {
    if (calc.answer || calc.error) { calc.answer = ""; calc.error = ""; return; }
    // a function name, " mod ", ans and ×10^ go as a whole
    const m = /(?:[\p{L}₀-₉]+\(|\s?mod\s?|ans|×10\^)$/u.exec(calc.expr);
    calc.expr = calc.expr.slice(0, -(m?.[0].length || 1)); return;
  }
  if (k === "=") {
    if (!calc.expr || calc.answer) return;
    // "x" then = starts an assignment (x = …) instead of working out x
    if (!isProg() && /^[\p{L}_][\p{L}_₀-₉]*$/u.test(calc.expr) && !Object.prototype.hasOwnProperty.call(calc.vars, calc.expr) && !RESERVED.has(calc.expr)) { calc.expr += " = "; return; }
    const r = run(calc.expr);
    if (!("value" in r)) { calc.error = r.error; return; }
    if (open() > 0) calc.expr += ")".repeat(open()); // the brackets closed for you show in the sum and its history
    calc.answer = r.value; calc.error = ""; calc.ans = r.exact;
    if ("assigned" in r && typeof r.assigned === "string") calc.vars[r.assigned] = r.exact;
    addHistory(calc.expr, r.value, r.exact, isProg() ? prog.base : undefined);
    return;
  }
  if (k === "MC") { calc.mem = ""; return; }
  if (k === "MR") { if (calc.mem) operand(typedValue(calc.mem)); return; }
  if (k === "M+") return memAdd("+");
  if (k === "M−") return memAdd("−");
  if (k.startsWith("fn:")) return operand(k.slice(3));
  if (k.startsWith("op:")) return after(k.slice(3));
  if (k === "nroot") { // 3 ⁿ√ 8: the number before becomes the root's index (³√8); with none it is a square root
    fromAnswer(false);
    const n = tailNumber();
    if (/^\d+$/.test(n)) calc.expr = calc.expr.slice(0, -n.length) + [...n].map((d) => SUP[d]).join("") + "√";
    else operand("√");
    return;
  }
  if (k === "%" || k === "!") return after(k);
  if (isOp(k)) {
    fromAnswer(true);
    if (!calc.expr) { if (k === "−") calc.expr = "−"; return; } // a sum can start with a minus sign, not with the others
    if (isOp(last())) { calc.expr = calc.expr.slice(0, -1) + (calc.expr.length === 1 && k !== "−" ? "" : k); return; } // swap the sign just typed
    if (/[(^]$/.test(calc.expr) && k !== "−") return;
    calc.expr += k; return;
  }
  if (k === "()") {
    fromAnswer(true);
    calc.expr += open() > 0 && endsOperand() ? ")" : (endsOperand() ? "×(" : "(");
    return;
  }
  if (k === "(") { fromAnswer(false); calc.expr += "("; return; }
  if (k === ")") { if (open() > 0 && endsOperand()) calc.expr += ")"; return; }
  if (k === "±") {
    fromAnswer(true);
    const n = tailNumber(), head = calc.expr.slice(0, calc.expr.length - n.length);
    if (head.endsWith("(−")) calc.expr = head.slice(0, -2) + n;
    else calc.expr = head + (!n && endsOperand() ? "×" : "") + "(−" + n;
    return;
  }
  if (k === ".") {
    fromAnswer(false);
    if (tailNumber().includes(".")) return;
    if (last() === ")") calc.expr += "×";
    calc.expr += /\d$/.test(calc.expr) ? "." : "0.";
    return;
  }
  if (/^\d$/.test(k)) {
    fromAnswer(false);
    // after ")" or the constant e or π on its own, a digit multiplies: e then 5 is e×5, never read as 10⁵ (but 1e5 typed
    // on the keyboard stays scientific entry)
    if (last() === ")" || /(?:^|[^\p{L}\d._₀-₉])[eπ]$/u.test(calc.expr)) calc.expr += "×";
    if (tailNumber() === "0") calc.expr = calc.expr.slice(0, -1); // no leading zeros: 05 becomes 5
    calc.expr += k;
    return;
  }
  // a letter typed on the keyboard (sin, x, ans…): part of a name
  if (/^[\p{L}_]$/u.test(k)) { fromAnswer(false); calc.expr += k; }
}

/** Keys that work differently in programming mode; true when handled */
function progPress(k: string): boolean {
  if (k === ".") return true; // whole numbers only
  if (k === "⌫" && !calc.answer && !calc.error) { // an operator word goes as a whole
    const m = /(?:\s?(?:AND|NAND|OR|NOR|XOR|XNOR|mod|rol|ror|<<|>>)\s?|NOT\s?|(?:ones|twos)\(|ans)$/.exec(calc.expr);
    calc.expr = calc.expr.slice(0, -(m?.[0].length || 1)); return true;
  }
  if (/^[\dA-F]$/.test(k)) {
    if (!progDigit(k)) return true; // 2 in binary, A in decimal: not a digit here
    fromAnswer(false);
    if (/(?:\)|ans)$/.test(calc.expr)) calc.expr += "×";
    if (tailNumber() === "0") calc.expr = calc.expr.slice(0, -1);
    calc.expr += k; return true;
  }
  return /^[\p{L}_]$/u.test(k); // other letters are not typed (they aren't digits here)
}

/** A field of a form (Financial mode's functions): its text cleaned like pasted text (the user's decimal mark, - for −)
 *  and worked out with the calculator's settings, variables and ans */
export function fieldText(text: string): string { return sanitizeInput(text, settings.decimalMark); }
// (to at least 6 decimals: an interest rate of 0.05/12 shown as 0 or 4.17×10⁻³ would be no help)
export function workOut(text: string): EvalResult {
  return evaluate(fieldText(text), { ...evalOptions(), decimals: Math.max(settings.decimals, 6), maxBits: PREVIEW_BITS });
}
/** A function call filled in on a form: worked out like =, so it is on the display with its answer and in history.
 *  A sum being typed that waits for a number (2 ×) takes the call in instead. "" when done, else the error. */
export function enterCall(expr: string): string {
  const r = run(expr);
  if (!("value" in r)) return r.error;
  if (!calc.answer && !calc.error && /[+−×÷^(]$/.test(calc.expr)) { calc.expr += expr; return ""; }
  calc.expr = expr; calc.answer = ""; calc.error = "";
  press("=");
  return "";
}

/** Pasted text, cleaned into an expression: it carries on from an answer when it starts with an operator */
export function paste(text: string) {
  if (isProg()) {
    const s = text.replace(/[^\w\s+\-−×÷*/()&|^~<>%₀-₉]/g, "").replace(/\s+/g, " ").trim();
    if (s) { if (/^[+×÷*/&|^<>%]/.test(s)) after(s); else operand(s); }
    return;
  }
  const s = sanitizeInput(text, settings.decimalMark);
  if (!s) return;
  if (/^[+×÷^%!]/.test(s)) after(s); else operand(s);
}

/** The key a keyboard key stands for, or "". A letter e is typed as a letter, so 1e5 is scientific entry (100000);
 *  only the on-screen e key gives the constant (2×e). Ctrl+E is the ×10ʸ key, as in GNOME's calculator. */
export function keyFor(e: KeyboardEvent): string {
  const k = e.key;
  if (e.ctrlKey || e.metaKey || e.altKey) return e.ctrlKey && !e.metaKey && !e.altKey && k.toLowerCase() === "e" && !isProg() ? "op:×10^" : "";
  if (isProg()) {
    // programming mode: hex digits as letters, C's bit operators (so ^ is XOR here, not a power), % is mod, < and > shift
    const pk: Record<string, string> = { "&": "op: AND ", "|": "op: OR ", "^": "op: XOR ", "~": "fn:NOT ", "<": "op: << ", ">": "op: >> ", "%": "op: mod ", ".": "", ",": "", "!": "" };
    if (k in pk) return pk[k]!;
    if (/^[\da-f]$/i.test(k)) return progDigit(k.toUpperCase()) ? k.toUpperCase() : "";
    if (/^[\p{L}_]$/u.test(k)) return "";
  }
  if (/^\d$/.test(k)) return k;
  const map: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", ".": ".", ",": ".", "(": "(", ")": ")",
    "^": "op:^", "%": "%", "!": "!", "|": "fn:|", ";": "fn:;", " ": "", Enter: "=", "=": "=", Backspace: "⌫", Escape: "AC", Delete: "C" };
  if (k in map) return map[k]!;
  return /^[\p{L}_]$/u.test(k) ? k : "";
}
