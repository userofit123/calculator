// Text pasted (or dropped) into the calculator, made into an expression it can read: the user's decimal mark and
// thousands grouping removed, ASCII signs turned into the calculator's own, and anything else (currency signs, stray
// words around a number) left out.
export function sanitizeInput(text: string, decimalMark: "." | "," = "."): string {
  let s = text.replace(/[   ']/g, " ").trim();
  // a mixed number on its own (copied from the display in mixed format): 1 3/4 is 1 + 3/4, not 13/4 or 1 × 3/4. Only
  // with a proper fraction after the space, so 1 234/2 (a grouped 1234) isn't taken for one
  const mx = /^([-−–]?)(\d+) (\d+)\/(\d+)$/.exec(s);
  if (mx && BigInt(mx[3]!) < BigInt(mx[4]!)) return `${mx[1] ? "−" : ""}(${mx[2]}+${mx[3]}÷${mx[4]})`;
  if (decimalMark === ",") {
    s = s.replace(/(\d)\.(?=\d{3}(?!\d))/g, "$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1"); // 1.234.567,5 → 1234567,5
    s = s.replace(/(\d),(?=\d)/g, "$1.");
  } else {
    s = s.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1"); // 1,234,567.5 → 1234567.5
  }
  s = s.replace(/[-–—]/g, "−").replace(/[*·⋅]/g, "×").replace(/[/∕]/g, "÷").replace(/,/g, ";");
  s = s.replace(/[^\p{L}\d.+−×÷^()|!%=;√∛∜⁰¹²³⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄₅₆₇₈₉π ]/gu, "");
  return s.replace(/\s+/g, " ").replace(/\s*=\s*$/, "").trim();
}
