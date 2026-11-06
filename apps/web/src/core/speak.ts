// What a screen reader says for a sum on the display: "2 × 3" read as "2 times 3", "√9" as "square root of 9", "x²" as
// "squared". Only the symbols are put into words (no maths here); numbers stay digits, which readers say correctly.
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "minus ", "ⁿ": "n", "ˣ": "x", "ʸ": "y" };
const WORDS: [RegExp, string][] = [
  [/×10\^/g, " times ten to the power "],
  [/⁻¹/g, " inverse "],
  [/²/g, " squared "],
  [/³/g, " cubed "],
  [/[⁰¹⁴-⁹⁻]+/g, ""], // other superscripts are spelled out below as "to the power"
  [/×/g, " times "],
  [/÷/g, " divided by "],
  [/[−-]/g, " minus "],
  [/\+/g, " plus "],
  [/\^/g, " to the power "],
  [/∛/g, " cube root of "],
  [/√/g, " square root of "],
  [/π/g, " pi "],
  [/%/g, " percent "],
  [/!/g, " factorial "],
  [/=/g, " equals "],
  [/\(/g, " open bracket "],
  [/\)/g, " close bracket "],
  [/\|/g, " absolute "],
  [/<</g, " shift left "],
  [/>>/g, " shift right "],
  [/\brol\b/gi, " rotate left "],
  [/\bror\b/gi, " rotate right "],
  [/</g, " less than "],
  [/>/g, " greater than "],
  [/·/g, " "],
];

/** The display's text as words, for a screen reader (aria-label, the announcement after =) */
export function speak(text: string): string {
  if (!text) return "";
  // a power written in superscripts ("2³⁰"): "2 to the power 30", except the squared / cubed / inverse cases above
  let s = text.replace(/([⁰¹²³⁴-⁹⁻]{2,}|[⁰¹⁴-⁹])/g, (m) => (m === "⁻¹" ? m : " to the power " + [...m].map((c) => SUP[c] ?? c).join("") + " "));
  for (const [re, w] of WORDS) s = s.replace(re, w);
  // a minus straight after an operator or at the start is a negative number
  s = s.replace(/(^|times|divided by|plus|minus|power|bracket|of)\s+minus\s+(?=[\d.,])/g, "$1 negative ");
  s = s.replace(/^\s*minus\s+(?=[\d.,])/, "negative ");
  return s.replace(/\s+/g, " ").trim();
}
