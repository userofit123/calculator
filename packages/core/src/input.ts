// Text pasted (or dropped) into the calculator, made into an expression it can read: the user's decimal mark and
// thousands grouping removed, ASCII signs turned into the calculator's own, and anything else (currency signs, stray
// words around a number) left out.
export function sanitizeInput(text: string, decimalMark: "." | "," = "."): string {
  let s = text.replace(/[   ']/g, " ").trim();
  // a mixed number on its own (copied from the display in mixed format): 1 3/4 is 1 + 3/4, not 13/4 or 1 × 3/4. The
  // display always shows the fraction in lowest terms and proper, so only that counts: numerator without a leading zero,
  // below the denominator, coprime to it. Anything else is a space-grouped number (1 234/567 = 1234/567, 10 000/12)
  const mx = /^([-−–]?)(\d+) ([1-9]\d*)\/(\d+)$/.exec(s);
  if (mx) {
    const n = BigInt(mx[3]!), d = BigInt(mx[4]!), g = (a: bigint, b: bigint): bigint => (b ? g(b, a % b) : a);
    if (n < d && g(n, d) === 1n) return `${mx[1] ? "−" : ""}(${mx[2]}+${mx[3]}÷${mx[4]})`;
  }
  if (decimalMark === ",") {
    s = s.replace(/(\d)\.(?=\d{3}(?!\d))/g, "$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1"); // 1.234.567,5 → 1234567,5
    s = s.replace(/(\d),(?=\d)/g, "$1.");
  } else {
    s = s.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1"); // 1,234,567.5 → 1234567.5
  }
  s = s.replace(/[-–—]/g, "−").replace(/[*·⋅]/g, "×").replace(/[/∕]/g, "÷").replace(/,/g, ";");
  // the degree sign stays in a unit conversion (100 °F in °C), where it is part of a unit
  const deg = /\s(?:in|to)\s/i.test(s) ? "°℃℉" : "";
  s = s.replace(new RegExp(`[^\\p{L}\\d.+−×÷^()|!%=;√∛∜⁰¹²³⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄₅₆₇₈₉π≈ ${deg}]`, "gu"), "");
  // "≈" right before a number (a copied estimate, "≈1.414e500") keeps it an estimate: taken as exact digits it would
  // claim a precision it doesn't have; anywhere else it is left out
  s = s.replace(/≈\s*\+?/g, "≈").replace(/≈(?![−\d.])/g, "");
  return s.replace(/\s+/g, " ").replace(/\s*=\s*$/, "").trim();
}
