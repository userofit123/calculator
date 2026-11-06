// The calculator's state, kept outside the page so it survives moving to another page and back. The maths is in
// @calc/core; here only the typed text is edited (append, delete, brackets, sign) and handed over to be worked out.
import { reactive, watch } from "vue";
import { evaluate } from "@calc/core";
import { readJson, writeJson } from "./prefs";

export type Mode = "basic" | "advanced" | "financial" | "programming";
export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "basic", label: "Basic", hint: "Everyday sums" },
  { id: "advanced", label: "Advanced", hint: "Powers, roots, trigonometry, logarithms" },
  { id: "financial", label: "Financial", hint: "Loans, interest, depreciation" },
  { id: "programming", label: "Programming", hint: "Binary, octal, hex, bit operations" },
];

const OPS = ["+", "−", "×", "÷"];
export const calc = reactive({
  mode: readJson<Mode>("calcMode", "basic"),
  expr: "",
  /** the answer after =, or "" while typing */
  answer: "",
  error: "",
});
watch(() => calc.mode, (m) => writeJson("calcMode", m));

const last = () => calc.expr.slice(-1);
const isOp = (c: string) => OPS.includes(c);
/** The number being typed at the end of the expression ("" if none) */
const tailNumber = () => /(\d*\.?\d*)$/.exec(calc.expr)?.[1] ?? "";
const open = () => (calc.expr.match(/\(/g)?.length ?? 0) - (calc.expr.match(/\)/g)?.length ?? 0);

/** What = would give now, shown faintly under the expression while typing ("" when it isn't complete yet) */
export function preview(): string {
  if (!calc.expr || calc.answer) return "";
  const r = evaluate(calc.expr);
  return "value" in r ? r.value : "";
}

// after =, a number starts afresh and an operator carries on from the answer
function fromAnswer(keepAnswer: boolean) {
  if (!calc.answer && !calc.error) return;
  calc.expr = keepAnswer && calc.answer ? calc.answer.replace(/^-/, "−") : "";
  calc.answer = ""; calc.error = "";
}

export function press(k: string) {
  if (k === "AC") { calc.expr = ""; calc.answer = ""; calc.error = ""; return; }
  if (k === "⌫") { if (calc.answer || calc.error) { calc.answer = ""; calc.error = ""; return; } calc.expr = calc.expr.slice(0, -1); return; }
  if (k === "=") {
    if (!calc.expr || calc.answer) return;
    const r = evaluate(calc.expr);
    if ("value" in r) { calc.answer = r.value; calc.error = ""; } else calc.error = r.error;
    return;
  }
  if (isOp(k)) {
    fromAnswer(true);
    if (!calc.expr) { if (k === "−") calc.expr = "−"; return; } // a sum can start with a minus sign, not with the others
    if (isOp(last())) { calc.expr = calc.expr.slice(0, -1) + (calc.expr.length === 1 && k !== "−" ? "" : k); return; } // swap the sign just typed
    if (last() === "(" && k !== "−") return;
    calc.expr += k; return;
  }
  if (k === "()") {
    fromAnswer(true);
    const l = last();
    calc.expr += open() > 0 && (/[\d.)]/.test(l)) ? ")" : (/[\d.)]/.test(l) ? "×(" : "(");
    return;
  }
  if (k === "(") { fromAnswer(false); calc.expr += /[\d.)]/.test(last()) ? "×(" : "("; return; }
  if (k === ")") { if (open() > 0 && /[\d.)]/.test(last())) calc.expr += ")"; return; }
  if (k === "±") {
    fromAnswer(true);
    const n = tailNumber(), head = calc.expr.slice(0, calc.expr.length - n.length);
    if (head.endsWith("(−")) calc.expr = head.slice(0, -2) + n;
    else calc.expr = head + (!n && last() === ")" ? "×" : "") + "(−" + n;
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
    if (last() === ")") calc.expr += "×";
    if (tailNumber() === "0") calc.expr = calc.expr.slice(0, -1); // no leading zeros: 05 becomes 5
    calc.expr += k;
  }
}

/** The key a keyboard key stands for, or "" */
export function keyFor(e: KeyboardEvent): string {
  const k = e.key;
  if (/^\d$/.test(k)) return k;
  const map: Record<string, string> = { "+": "+", "-": "−", "*": "×", x: "×", X: "×", "/": "÷", ".": ".", ",": ".", "(": "(", ")": ")",
    Enter: "=", "=": "=", Backspace: "⌫", Escape: "AC", Delete: "AC" };
  return map[k] ?? "";
}
