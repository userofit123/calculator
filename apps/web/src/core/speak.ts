// What a screen reader says for a sum on the display: "2 × 3" read as "2 times 3", "√9" as "square root of 9", "x²" as
// "squared". Only the symbols are put into words (no maths here); numbers stay digits, which readers say correctly.
// The words are texts (say.* in i18n/en/calc.ts), so Hebrew gets "2 כפול 3". Function names typed in a sum (sin, log)
// stay as they are, in every language.
import { t, type Key } from "./i18n";

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "ⁿ": "n", "ˣ": "x", "ʸ": "y" };
// a word is marked as \u0001name\u0001 until the end, so the rules below can find operators whatever the language
const w = (k: string) => ` \u0001${k}\u0001 `;
const WORDS: [RegExp, string][] = [
  [/×10\^/g, w("timesTen")],
  [/⁻¹/g, w("inverse")],
  [/²/g, w("squared")],
  [/³/g, w("cubed")],
  [/[⁰¹⁴-⁹⁻]+/g, ""], // other superscripts are spelled out below as "to the power"
  [/×/g, w("times")],
  [/÷/g, w("divided")],
  [/[−-]/g, w("minus")],
  [/\+/g, w("plus")],
  [/\^/g, w("power")],
  [/∛/g, w("cbrt")],
  [/√/g, w("sqrt")],
  [/π/g, w("pi")],
  [/%/g, w("percent")],
  [/!/g, w("factorial")],
  [/=/g, w("equals")],
  [/\(/g, w("open")],
  [/\)/g, w("close")],
  [/\|/g, w("abs")],
  [/<</g, w("shl")],
  [/>>/g, w("shr")],
  [/\brol\b/gi, w("rol")],
  [/\bror\b/gi, w("ror")],
  [/</g, w("lt")],
  [/>/g, w("gt")],
  [/·/g, " "],
];

/** The display's text as words, for a screen reader (aria-label, the announcement after =), in the language shown */
export function speak(text: string): string {
  if (!text) return "";
  // a power written in superscripts ("2³⁰"): "2 to the power 30", except the squared / cubed / inverse cases above
  // (its minus sign is kept as "-" and read as "negative" with the number)
  let s = text.replace(/([⁰¹²³⁴-⁹⁻]{2,}|[⁰¹⁴-⁹])/g, (m) => (m === "⁻¹" ? m : w("power") + [...m].map((c) => SUP[c] ?? c).join("").replace(/^-/, w("neg")) + " "));
  for (const [re, x] of WORDS) s = s.replace(re, x);
  // a minus at the start, or straight after an operator that still waits for its number (×, ÷, +, −, ^, "×10^", "(", √,
  // ∛), is a negative number. After one that ends a number (")", ², ³, ⁻¹, %, !) it is a subtraction: "5² − 3".
  s = s.replace(/(^\s*|\u0001(?:times|timesTen|divided|plus|minus|power|open|cbrt|sqrt)\u0001\s+)\u0001minus\u0001(?=\s+[\d.,])/g, "$1\u0001neg\u0001");
  s = s.replace(/\u0001(\w+)\u0001/g, (_, k: string) => t(("say." + k) as Key));
  return s.replace(/\s+/g, " ").trim();
}
