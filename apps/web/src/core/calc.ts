// The calculator's state, kept outside the page so it survives moving to another page and back. The maths is in
// @calc/core; here only the typed text is edited (append, delete, brackets, sign) and handed over to be worked out.
// Memory, variables, the last answer and the calculator settings are kept on this device.
import { reactive, ref, watch } from "vue";
import {
  evaluate, formatDisplay, fractionNote, parseStored, sanitizeInput, storable, RESERVED, isFunction, type AngleUnit, type EvalOptions, type EvalResult, type NumberFormat,
  evaluateProgramming, formatInt, fitsWord, literal, rebase, toProgramming, fromProgramming, type Base, type WordSize, type ProgOptions,
} from "@calc/core";
import { readJson, writeJson } from "./prefs";
import { addHistory, history, type HistItem } from "./history";
import { toast } from "./toast";
import { t as tr, type Key, langChoice, resolveLang } from "./i18n";
import { LANG_INFO } from "../i18n/langs";
import { tMsg } from "./msg";
import { startMode, deviceHints, isFirstOpen } from "./keyboard";
import { unitOptions, waiting, ready } from "./unitCalc";

export type Mode = "basic" | "advanced" | "financial" | "programming" | "keyboard" | "date" | "percent" | "discount" | "tip";
// label and hint are English; shown through modeLabel / modeHint (the texts mode.* and modeHint.*)
export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "basic", label: "Basic", hint: "Everyday sums" },
  { id: "advanced", label: "Advanced", hint: "Powers, roots, trigonometry, logarithms" },
  { id: "financial", label: "Financial", hint: "Loans, interest, depreciation" },
  { id: "programming", label: "Programming", hint: "Binary, octal, hex, bit operations" },
  // no keypad: earlier lines above one line to type whole sums in (KeyboardCalc), like GNOME's Keyboard mode
  { id: "keyboard", label: "Keyboard", hint: "Type whole sums, no keypad" },
  // C-66: the tools below are not calculators but forms in place of the display and keys (TipCalc, PercentCalc,
  // DateCalc, loaded when chosen). They are tabs next to the calculator's tab, in this order, not in its type menu.
  // Tip & Split, Discount and Percent were Everyday mode's tabs (its VAT tab is retired).
  { id: "tip", label: "Tip & Split", hint: "Tip on a bill, and splitting it" },
  { id: "discount", label: "Discount", hint: "Sale price after one or two discounts" },
  { id: "percent", label: "Percent", hint: "Percent of a number, percent change, adding a percent" },
  // not a keypad either: days between dates, adding to a date, age, times
  { id: "date", label: "Date", hint: "Days between dates, adding to a date, age, times" },
];
export const modeLabel = (m: Mode) => tr(("mode." + m) as Key);
export const modeHint = (m: Mode) => tr(("modeHint." + m) as Key);
/** modes with their own forms in place of the display and keys: the tools, each a tab of its own */
export const formMode = (m: Mode) => m === "date" || m === "percent" || m === "discount" || m === "tip";
const isMode = (m: unknown): m is Mode => MODES.some((x) => x.id === m);
/** the calculator types (the calculator tab's menu) and the tools (tabs next to it) */
export const CALC_TYPES = MODES.filter((m) => !formMode(m.id));
export const TOOLS = MODES.filter((m) => formMode(m.id));

export interface CalcSettings { angle: AngleUnit; decimals: number; format: NumberFormat; thousands: boolean; decimalMark: "." | "," }
const hadSettings = Object.keys(readJson<object>("calcSettings", {})).length > 0;
// On a first run (no settings saved yet) the decimal mark follows the language: a comma in German, French, Russian, …
const firstMark = (): "." | "," => (!hadSettings && LANG_INFO[resolveLang(langChoice.value)].comma ? "," : ".");
// "everyday" was a switch before C-59 (it is gone since Everyday's tools became tabs of their own): an old saved value is dropped
const { everyday: _oldEveryday, ...savedSettings } = readJson<Partial<CalcSettings> & { everyday?: unknown }>("calcSettings", {});
export const settings = reactive<CalcSettings>({ angle: "deg", decimals: 10, format: "auto", thousands: true, decimalMark: firstMark(), ...savedSettings });
watch(settings, (s) => writeJson("calcSettings", s), { deep: true });
// C-65: grouping is on by default now. Installs saved before that have thousands: false stored, so it is switched on once
// (the marker means a user who turns it off later keeps it off). Set after the watch so the change is saved too.
if (!readJson<boolean>("calcThousandsOn", false)) { if (hadSettings) settings.thousands = true; writeJson("calcThousandsOn", true); }
// C-66 (first round) kept chosen mode shortcuts here; the tool tabs replaced them, so the saved list is dropped
try { localStorage.removeItem("calcShortcuts"); } catch { /* storage blocked: nothing was saved either */ }
/** The number formats: label for Settings and the display's menu, short label for the display's chip */
export const FORMATS: { id: NumberFormat; label: string; short: string; hint: string }[] = [
  { id: "auto", label: "Auto", short: "Auto", hint: "Decimal, ×10ⁿ for very large or small numbers" },
  { id: "fixed", label: "Fixed", short: "Fixed", hint: "Always plain decimals" },
  { id: "fraction", label: "Fraction", short: "a/b", hint: "Exact answers as a fraction: 7/4" },
  { id: "mixed", label: "Mixed", short: "a b/c", hint: "Exact answers as a mixed number: 1 3/4" },
  { id: "sci", label: "Sci", short: "Sci", hint: "Scientific: 1.2345×10³" },
  { id: "eng", label: "Eng", short: "Eng", hint: "Engineering, powers of 3: 12.345×10³" },
];
/** A format's label, short label and hint in the language shown (fmt.*, fmtShort.*, fmtHint.*) */
export const fmtLabel = (f: NumberFormat) => tr(("fmt." + f) as Key);
export const fmtShort = (f: NumberFormat) => tr(("fmtShort." + f) as Key);
export const fmtHint = (f: NumberFormat) => tr(("fmtHint." + f) as Key);
// the display's chip steps through the everyday ones (Fixed is in the menu and Settings, as it rarely changes)
const CYCLE: NumberFormat[] = ["auto", "fraction", "mixed", "sci", "eng"];
/** The next number format for the display's chip: Decimal → Fraction → Mixed → Sci → Eng → Decimal */
export function cycleFormat() { const i = CYCLE.indexOf(settings.format); settings.format = CYCLE[(i + 1) % CYCLE.length]!; }
/** Why the answer is shown as a decimal although Fraction or Mixed is chosen ("" when it isn't) */
export function answerNote(exact: string): string { return exact ? tMsg(fractionNote(parseStored(exact), settings.format)) : ""; }
export const ANGLES: { id: AngleUnit; label: string }[] = [{ id: "deg", label: "DEG" }, { id: "rad", label: "RAD" }, { id: "grad", label: "GRAD" }];

/** The saved mode. Everyday mode (before C-66) opens on the tool its last tab was (its VAT tab is gone: Percent); a
 *  mode this version doesn't have opens on Basic */
function readMode(): Mode | null {
  const m = readJson<unknown>("calcMode", null);
  if (m === "everyday") {
    const tab = readJson<{ tab?: unknown }>("everydayCalc", {}).tab;
    const to: Mode = tab === "discount" || tab === "tip" ? tab : "percent";
    // saved now: the Percent form's next save drops the tab, which would send a Discount user to Percent next time
    writeJson("calcMode", to);
    return to;
  }
  return m === null ? null : isMode(m) ? m : "basic";
}
const savedMode = readMode();
export const calc = reactive({
  mode: savedMode ?? "basic",
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
  /** a unit conversion's answer: the unit it is in ("mi") and, for currencies, where the rate came from ("" otherwise) */
  unit: "",
  note: "",
});
// an answer cleared or replaced by a sum being typed takes its unit with it
watch(() => calc.answer, (v) => { if (!v) { calc.unit = ""; calc.note = ""; } }, { flush: "sync" });
/** An answer with its unit, as shown and kept in history: "8.04672 km" */
export const withUnit = (value: string, unit?: string) => (unit ? `${value} ${unit}` : value);
const unitOf = (r: object) => ("unit" in r && typeof r.unit === "string" ? r.unit : "");
/** The calculator type the calculator tab goes back to from a tool: the last one used, kept on this device (a tool
 *  left open last time opens again, and its calculator tab still says Advanced if that was the type before it) */
const savedType = readJson<unknown>("calcType", null);
export const lastType = ref<Mode>(!formMode(calc.mode) ? calc.mode : isMode(savedType) && !formMode(savedType) ? savedType : "basic");
watch(() => calc.mode, (m) => { if (!formMode(m)) lastType.value = m; });
watch(lastType, (m) => writeJson("calcType", m));
/** the mode a first-ever open started in by itself: not saved, so it is decided again until the user picks one */
let autoMode: Mode | null = null, started = false;
watch(() => calc.mode, (m) => { if (m !== autoMode) { autoMode = null; writeJson("calcMode", m); } });
/** A first-ever open (no saved mode) on a computer with no touch screen starts in Keyboard mode, else Basic. Run once,
 *  by the calculator page before its first paint (the layout is known there). */
export function chooseStartMode(phone: boolean) {
  if (started) return;
  started = true;
  if (savedMode) return;
  // an existing user who never chose a mode (they have history, settings or an answer) stays on Basic
  if (!isFirstOpen({ mode: false, history: history.length > 0, settings: hadSettings, ans: !!calc.ans })) return;
  const m = startMode<Mode>(null, deviceHints(phone));
  if (m !== "basic") { autoMode = m; calc.mode = m; }
}
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
const run = (expr: string, maxBits?: number) => (isProg() ? evaluateProgramming(expr, progOptions()) : evaluate(expr, { ...evalOptions(), ...unitOptions(expr), maxBits }));
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
// Changing base or mode rewrites the display for the new one, which can't always give back the very text the user
// typed (0b half-typed, 2×e, a sum with AND going to Basic). So the text before each change is kept, and coming back
// to where it was typed without having edited anything in between brings that text back as it was. Edits are counted;
// the rewrites made here don't count as edits.
let edits = 0, quiet = false;
watch(() => [calc.expr, calc.answer, calc.error], () => { if (!quiet) edits++; }, { flush: "sync" });
const rewrite = (f: () => void) => { quiet = true; try { f(); } finally { quiet = false; } };
const progKey = () => `${prog.wordSize} ${prog.signed}`;
/** the display before the last change to or from programming mode (and the base, word size and sign it was read with) */
let kept: { prog: boolean; expr: string; answer: string; error: string; unit: string; note: string; base: Base; o: string; at: number } | null = null;
/** the sum in each base it was shown in since the last edit (with the word size and sign it was read with) */
let baseTexts: { at: number; o: string; t: Partial<Record<Base, string>> } | null = null;
/** Changes base; a sum being typed has its numbers rewritten, so it keeps its meaning */
export function setBase(b: Base) {
  if (!calc.answer && !calc.error && calc.expr) {
    if (!baseTexts || baseTexts.at !== edits || baseTexts.o !== progKey()) baseTexts = { at: edits, o: progKey(), t: {} };
    baseTexts.t[prog.base] = calc.expr;
    const t = baseTexts.t[b] ?? rebase(calc.expr, progOptions(), b);
    rewrite(() => { calc.expr = t; });
  }
  prog.base = b;
}
/** the last mode other than programming (and Date, which has no display), for a history entry from one of them */
let plainMode: Mode = calc.mode === "programming" || formMode(calc.mode) ? "basic" : calc.mode;
/** Brings a sum back from history in the mode it was worked out in: a programming-mode one with its base, word size
 *  and sign (its digits mean nothing in another base, and FF + 1 gives another answer in another word size), any
 *  other one out of programming mode (10 + 5 typed in Basic is 0x15 read in hex) */
export function restoreExpr(h: Pick<HistItem, "e" | "b" | "w" | "s">) {
  // the display is replaced: nothing on it is carried over to the entry's mode, or brought back
  calc.expr = ""; calc.answer = ""; calc.error = ""; kept = null;
  if (h.b) {
    calc.mode = "programming";
    prog.base = h.b as Base;
    // entries from before word size and sign were kept leave them as they are
    if (h.w) prog.wordSize = h.w as WordSize;
    if (h.s !== undefined) prog.signed = h.s;
  } else if (isProg() || formMode(calc.mode)) calc.mode = plainMode;
  calc.expr = h.e;
}
// Programming mode's digits mean something else in the other modes (FF is a variable there, 0.5 isn't a whole number,
// ^ is XOR), so changing to or from it carries the number on the display over written for the new mode, and a sum being
// typed has its numbers rewritten in the new base. What the new mode can't hold (a fraction, e, a variable, AND in
// Basic) isn't reinterpreted: the display is cleared with a message, and coming back unedited brings it back. Run at
// once (sync), before anything else is typed in the new mode.
watch(() => calc.mode, (m, old) => {
  if (m !== "programming" && !formMode(m)) plainMode = m;
  if ((m === "programming") === (old === "programming")) return;
  const toProg = isProg();
  const back = kept && kept.at === edits && kept.prog === toProg && (!toProg || (kept.base === prog.base && kept.o === progKey())) ? kept : null;
  const leaving = { prog: !toProg, expr: calc.expr, answer: calc.answer, error: calc.error, unit: calc.unit, note: calc.note, base: prog.base, o: progKey() };
  let lost = false;
  rewrite(() => {
    if (back) { calc.expr = back.expr; calc.answer = back.answer; calc.error = back.error; calc.unit = back.unit; calc.note = back.note; return; }
    if (calc.answer) {
      if (!toProg) calc.expr = typedValue(calc.ans);
      else if (/^-?\d+$/.test(calc.ans)) calc.expr = literal(BigInt(calc.ans), prog);
      else { calc.expr = ""; lost = true; }
    } else if (calc.expr) {
      const t = toProg ? toProgramming(calc.expr, calc.ans) : fromProgramming(calc.expr, progOptions());
      if (t === null) { calc.expr = ""; lost = true; }
      else calc.expr = toProg ? rebase(t, { ...prog, base: 10 }, prog.base) : t;
    }
    calc.answer = ""; calc.error = "";
  });
  kept = { ...leaving, at: edits };
  if (lost) toast(tr("calc.notInMode", { mode: modeLabel(m) }), { kind: "err" });
}, { flush: "sync" });
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
  if (!("value" in r)) { waiting(r); return r.error === "Number is too large" ? r.error : ""; } // 2^1000000: no point pressing =
  return r.value !== calc.expr ? withUnit(r.value, unitOf(r)) : "";
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
    // a fraction on the display (7/4, 1 3/4) carries on as ans: 7/4 then ^2 must square the whole of it
    calc.expr = !/[/ ]/.test(calc.answer) && "value" in r && r.exact === calc.ans ? calc.answer.replace(/^-/, "−") : "ans";
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
  if (isProg()) {
    if (/^-?\d+$/.test(exact)) return literal(BigInt(exact), prog);
    // (1÷3) would silently be 0 here (÷ is integer division): nothing is typed, and the user is told
    toast(tr("calc.notInMode", { mode: modeLabel("programming") }), { kind: "err" });
    return "";
  }
  const m = /^(-?)(\d+)\/(\d+)$/.exec(exact);
  return m ? `(${m[1] ? "−" : ""}${m[2]}÷${m[3]})` : exact.replace(/-/g, "−");
}
// the answer on the display follows the number format and decimal places (chosen from the display or in Settings); it
// is worked out again from the answer in full, so a fraction shown as a decimal can go back to the fraction
watch(() => [settings.format, settings.decimals], () => {
  if (calc.answer && !calc.error && !isProg() && calc.ans) rewrite(() => { calc.answer = valueText(calc.ans); });
});
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
    if (!isProg() && /^[\p{L}_][\p{L}_₀-₉]*$/u.test(calc.expr) && !Object.prototype.hasOwnProperty.call(calc.vars, calc.expr) && !RESERVED.has(calc.expr) && !isFunction(calc.expr)) { calc.expr += " = "; return; }
    const expr = calc.expr, r = run(expr);
    // a unit conversion whose code or rates are still loading: = again once they are there (same sum, nothing pressed since)
    if (waiting(r)) {
      ready(() => run(expr)).then(() => { if (calc.expr === expr && !calc.answer && !calc.error) press("="); }, () => { if (calc.expr === expr && !calc.answer && !calc.error) toast(tMsg(UNITS_FAILED), { kind: "err" }); });
      return;
    }
    if (!("value" in r)) { calc.error = r.error; return; }
    if (open() > 0) calc.expr += ")".repeat(open()); // the brackets closed for you show in the sum and its history
    calc.answer = r.value; calc.error = ""; calc.ans = r.exact;
    calc.unit = unitOf(r); calc.note = "note" in r && typeof r.note === "string" ? r.note : "";
    if ("assigned" in r && typeof r.assigned === "string") calc.vars[r.assigned] = r.exact;
    addHistory(calc.expr, withUnit(r.value, calc.unit), r.exact, isProg() ? { ...prog } : undefined, calc.mode, calc.unit);
    return;
  }
  // a space after a word, for a unit conversion typed on the keyboard ("5km in mi"); after a digit it isn't typed, so
  // 2 3 stays 23 as before
  if (k === " ") { if (!isProg() && !calc.answer && !calc.error && /\p{L}$/u.test(calc.expr)) calc.expr += " "; return; }
  if (k === "MC") { calc.mem = ""; return; }
  if (k === "MR") { if (calc.mem) { const v = typedValue(calc.mem); if (v) operand(v); } return; }
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
  // a form's figures are amounts and rates, read as decimals even with Fraction or Mixed chosen
  const format = settings.format === "fraction" || settings.format === "mixed" ? "auto" : settings.format;
  return evaluate(fieldText(text), { ...evalOptions(), format, decimals: Math.max(settings.decimals, 6), maxBits: PREVIEW_BITS });
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
    // a decimal mark is kept (with the user's comma read as one), so 3.14 is the whole-numbers error and not 314;
    // other commas are thousands separators
    const t = settings.decimalMark === "," ? text.replace(/,/g, ".") : text;
    const s = t.replace(/[^\w\s.+\-−×÷*/()&|^~<>%₀-₉]/g, "").replace(/\s+/g, " ").trim();
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

// --- Keyboard mode: a whole line typed at once (KeyboardCalc) ---
/** A typed line cleaned into an expression: the user's decimal mark and grouping, * / - for × ÷ − */
export const lineExpr = (text: string) => sanitizeInput(text, settings.decimalMark);
/** What Enter would give for the line now ("" while it isn't complete yet), as shown */
export function linePreview(text: string): string {
  const s = lineExpr(text);
  if (!s) return "";
  const r = evaluate(s, { ...evalOptions(), ...unitOptions(s), maxBits: PREVIEW_BITS });
  if (!("value" in r)) { waiting(r); return r.error === "Number is too large" ? r.error : ""; }
  return r.value !== s ? withUnit(r.value, r.unit) : "";
}
/** What Enter and = say when the unit tables or rates can't be loaded */
export const UNITS_FAILED = "Couldn't load the unit tables";
/** Enter: works the line out like =, so it is the answer (ans), sets a variable (x = 5) and goes into history.
 *  "" when done, else the error (or, while a conversion's tables load, a promise: see above). */
export function enterLine(text: string): string | Promise<void> {
  let s = lineExpr(text);
  if (!s) return "";
  const r = evaluate(s, { ...evalOptions(), ...unitOptions(s) });
  // a conversion whose code or rates are still loading: a promise for when they are there (it rejects if they can't be
  // loaded); the caller presses Enter again if the line is unchanged
  if (!("value" in r)) {
    if (waiting(r)) { const t = s; return ready(() => evaluate(t, { ...evalOptions(), ...unitOptions(t) })); }
    return r.error;
  }
  const o = (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0);
  if (o > 0) s += ")".repeat(o); // the brackets closed for you show in the line and its history
  calc.expr = s; calc.answer = r.value; calc.error = ""; calc.ans = r.exact;
  calc.unit = r.unit ?? ""; calc.note = r.note ?? "";
  if ("assigned" in r && typeof r.assigned === "string") calc.vars[r.assigned] = r.exact;
  addHistory(s, withUnit(r.value, r.unit), r.exact, undefined, "keyboard", r.unit);
  return "";
}
