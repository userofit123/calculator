import { describe, expect, it } from "vitest";
import { evaluateProgramming, formatInt, groupDigits, literal, rebase, toProgramming, fromProgramming, toggleBit, fromWord, toWord, fitsWord, type ProgOptions } from "../src";

const U8: ProgOptions = { base: 10, wordSize: 8, signed: false };
const U64: ProgOptions = { base: 10, wordSize: 64, signed: false };
const S8: ProgOptions = { base: 10, wordSize: 8, signed: true };
const v = (e: string, o: Partial<ProgOptions> = {}) => { const r = evaluateProgramming(e, { ...U64, ...o }); return "value" in r ? r.value : "error: " + r.error; };
const cases = (list: [string, string, Partial<ProgOptions>?][]) => list.forEach(([e, want, o]) => it(`${e} = ${want}${o ? " " + JSON.stringify(o) : ""}`, () => expect(v(e, o)).toBe(want)));

describe("number literals", () => cases([
  ["1010₂", "10"],
  ["777₈", "511"],
  ["FF₁₆", "255"],
  ["99₁₀", "63", { base: 16 }],
  ["0xff", "255"],
  ["0o17", "15"],
  ["0b1010", "10"],
  ["FF", "FF", { base: 16 }],
  ["ff + 1", "100", { base: 16 }],
  ["0B1", "B1", { base: 16 }], // in hex mode 0B1 is a hex number, not a binary prefix
  ["101 + 1", "110", { base: 2 }],
  ["17 + 1", "20", { base: 8 }],
  ["DEAD₁₆", "57005"],
]));

describe("bad literals", () => cases([
  ["102", "error: 102 is not a binary number", { base: 2 }],
  ["19", "error: 19 is not an octal number", { base: 8 }],
  ["FF", "error: FF is not a decimal number"],
  ["12₂", "error: 12 is not a binary number"],
  ["5₃", "error: Base 3 isn't one of 2, 8, 10 and 16"],
  ["0x", "error: 0x is not a hexadecimal number"],
  ["1.5", "error: Programming mode works with whole numbers"],
  ["xyz", "error: Unknown variable xyz"],
]));

describe("arithmetic on whole numbers", () => cases([
  ["2 + 3 × 4", "14"],
  ["7 ÷ 2", "3"],
  ["(0 − 7) ÷ 2", "-3", { signed: true }],
  ["7 mod 3", "1"],
  ["(−7) mod 3", "2", { signed: true }],
  ["7 mod (−3)", "-2", { signed: true }],
  ["7 % 3", "1"],
  ["2 ** 10", "1024"],
  ["2(3)", "6"],
  ["(2 + 3", "5"],
  ["5 ÷ 0", "error: Division by zero"],
  ["5 mod 0", "error: Division by zero"],
  ["2 ** −1", "error: A negative power isn't a whole number"],
  ["(1 + 2))", "error: Too many closing brackets"],
  ["", "error: Malformed expression"],
  ["1 +", "error: Malformed expression"],
]));

describe("bitwise operators", () => cases([
  ["12 AND 10", "8"],
  ["12 OR 10", "14"],
  ["12 XOR 10", "6"],
  ["12 & 10", "8"],
  ["12 | 10", "14"],
  ["12 ^ 10", "6"], // ^ is XOR here (as in C), not a power
  ["12 and 10", "8"],
  ["NOT 0", "255", { wordSize: 8 }],
  ["~0", "FFFF", { wordSize: 16, base: 16 }],
  ["NOT 5", "250", { wordSize: 8 }],
  ["12 NAND 10", "247", { wordSize: 8 }],
  ["12 NOR 10", "241", { wordSize: 8 }],
  ["12 XNOR 10", "249", { wordSize: 8 }],
  ["1 OR 2 AND 3", "3"], // AND binds tighter, as in C
  ["1 OR 6 XOR 4", "3"],
  ["F0 AND 3C OR 1", "31", { base: 16 }],
  ["NOT NOT 5", "5", { wordSize: 8 }],
]));

describe("GNOME's errors for bitwise operators", () => cases([
  ["(0 − 1) AND 1", "error: Bitwise AND is only defined for non-negative integers"],
  ["(0 − 1) OR 1", "error: Bitwise OR is only defined for non-negative integers"],
  ["1 XOR (0 − 1)", "error: Bitwise XOR is only defined for non-negative integers"],
  ["NOT (0 − 1)", "error: Bitwise NOT is only defined for non-negative integers"],
  ["256 AND 1", "error: Overflow. Try a bigger word size", { wordSize: 8 }],
  ["NOT 256", "error: Overflow. Try a bigger word size", { wordSize: 8 }],
  ["ones(0 − 1)", "error: Ones' complement is only defined for non-negative integers"],
]));

describe("shifts and rotation", () => cases([
  ["1 << 4", "16"],
  ["256 >> 4", "16"],
  ["1 << 3 + 1", "16"], // + binds tighter than a shift, as in C
  ["5 >> 1", "2"],
  ["1 << 8", "error: Overflow. Try a bigger word size", { wordSize: 8 }],
  ["1 << 7", "128", { wordSize: 8 }],
  ["(0 − 8) >> 1", "-4", { signed: true }],
  ["1 << 100000", "error: Overflow. Try a bigger word size"],
  ["81 rol 1", "3", { base: 16, wordSize: 8 }],
  ["81 ror 1", "C0", { base: 16, wordSize: 8 }],
  ["1 rol 9", "2", { wordSize: 8 }],
  ["1 ror 0", "1", { wordSize: 8 }],
  ["1 shl 2", "4"],
]));

describe("ones' and two's complement", () => cases([
  ["ones(5)", "250", { wordSize: 8 }],
  ["twos(5)", "251", { wordSize: 8 }],
  ["twos(1)", "FFFF", { wordSize: 16, base: 16 }],
  ["twos 0", "0", { wordSize: 8 }],
  ["twos(5)", "-5", { wordSize: 8, signed: true }],
  ["ones 5", "-6", { wordSize: 8, signed: true }],
]));

describe("word size and overflow", () => cases([
  ["255 + 1", "error: Overflow. Try a bigger word size", { wordSize: 8 }],
  ["255", "255", { wordSize: 8 }],
  ["300 − 100", "200", { wordSize: 8 }], // only the answer must fit, like GNOME's
  ["3 − 5", "error: Below zero: turn on Signed for negative numbers"],
  ["FFFFFFFFFFFFFFFF", "FFFFFFFFFFFFFFFF", { base: 16 }],
  ["FFFFFFFFFFFFFFFF + 1", "error: Overflow. Try a bigger word size", { base: 16 }],
  ["2 ** 100000", "error: Overflow. Try a bigger word size"],
  ["2 ** 4000 ** 2", "error: Overflow. Try a bigger word size"],
]));

describe("signed numbers (two's complement)", () => cases([
  ["3 − 5", "-2", { signed: true, wordSize: 8 }],
  ["3 − 5", "FE", { signed: true, wordSize: 8, base: 16 }],
  ["11 − 101", "11111110", { signed: true, wordSize: 8, base: 2 }],
  ["FF", "FF", { signed: true, wordSize: 8, base: 16 }],
  ["FF₁₆ + 0", "-1", { signed: true, wordSize: 8 }],
  ["0xFF", "-1", { signed: true, wordSize: 8 }],
  ["0x80", "-128", { signed: true, wordSize: 8 }],
  ["127 + 1", "error: Overflow. Try a bigger word size", { signed: true, wordSize: 8 }],
  ["(−1) AND 0F₁₆", "15", { signed: true, wordSize: 8 }],
  ["NOT 0", "-1", { signed: true, wordSize: 8 }],
  ["(−128) − 1", "error: Overflow. Try a bigger word size", { signed: true, wordSize: 8 }],
  ["−128", "-128", { signed: true, wordSize: 8 }],
]));

describe("ans", () => {
  it("is the previous answer", () => expect(v("ans + 1", { ans: "41" })).toBe("42"));
  it("is 0 when there is none", () => expect(v("ans")).toBe("0"));
  it("must be whole", () => expect(v("ans + 1", { ans: "1/3" })).toBe("error: ans is not a whole number"));
  it("exact is decimal whatever the base", () => expect(evaluateProgramming("FF", { ...U64, base: 16 })).toEqual({ value: "FF", exact: "255" }));
});

describe("formatting and the bit view", () => {
  it("formats in every base", () => {
    expect(formatInt(255n, 16, U8)).toBe("FF");
    expect(formatInt(255n, 8, U8)).toBe("377");
    expect(formatInt(255n, 2, U8)).toBe("11111111");
    expect(formatInt(-1n, 10, S8)).toBe("-1");
    expect(formatInt(-1n, 16, S8)).toBe("FF");
  });
  it("groups digits", () => {
    expect(groupDigits("101101", 4)).toBe("10 1101");
    expect(groupDigits("1234567", 3, ",")).toBe("1,234,567");
    expect(groupDigits("-1234", 3)).toBe("-1 234");
  });
  it("words and bits", () => {
    expect(toWord(-1n, S8)).toBe(255n);
    expect(fromWord(255n, S8)).toBe(-1n);
    expect(fromWord(255n, U8)).toBe(255n);
    expect(toggleBit(0n, 7, U8)).toBe(128n);
    expect(toggleBit(0n, 7, S8)).toBe(-128n);
    expect(toggleBit(5n, 0, U8)).toBe(4n);
    expect(fitsWord(256n, U8)).toBe(false);
    expect(fitsWord(-1n, U8)).toBe(false);
    expect(fitsWord(-128n, S8)).toBe(true);
  });
  it("literals read back as the same number", () => {
    for (const [n, o] of [[-5n, { ...S8, base: 10 }], [-5n, { ...S8, base: 16 }], [-5n, { ...S8, base: 2 }], [200n, { ...U8, base: 8 }]] as const) {
      const r = evaluateProgramming(literal(n, o), o);
      expect("exact" in r && r.exact).toBe(n.toString());
    }
  });
});

describe("switching base while typing", () => {
  it("rewrites plain numbers", () => expect(rebase("FF AND 0F", { ...U64, base: 16 }, 2)).toBe("11111111 AND 1111"));
  it("keeps numbers with their own base and words", () => expect(rebase("10 + 0x10 + 10₈ + ans", U64, 16)).toBe("A + 0x10 + 10₈ + ans"));
  it("a signed pattern becomes a negative decimal", () => expect(rebase("FB + 1", { ...S8, base: 16 }, 10)).toBe("(−5) + 1"));
  it("leaves text it can't read alone", () => expect(rebase("1 $ 2", U64, 16)).toBe("1 $ 2"));
  it("signed: a decimal number past the top bit keeps its value (not a negative bit pattern)", () => {
    const H8 = { ...S8, base: 16 as const };
    expect(rebase("128 - 1", S8, 16)).toBe("128₁₀ - 1");
    expect(evaluateProgramming(rebase("128 - 1", S8, 16), H8)).toEqual(evaluateProgramming("7F", H8));
    expect(rebase("255 + 0", S8, 16)).toBe("255₁₀ + 0");
    expect(evaluateProgramming(rebase("255 + 0", S8, 2), { ...S8, base: 2 })).toEqual(evaluateProgramming("255 + 0", S8));
    expect(rebase("127 + 300", S8, 16)).toBe("7F + 12C"); // in range, or too big to be a pattern: plain digits
  });
  it("0b numbers become subscript binary in hex mode (0b101 would read as B101)", () => {
    expect(rebase("0b101 + 1", U64, 16)).toBe("101₂ + 1");
    expect(evaluateProgramming(rebase("0b101 + 1", U64, 16), { ...U64, base: 16 })).toMatchObject({ exact: "6" });
    expect(rebase("0b101 + 1", U64, 2)).toBe("0b101 + 1");
  });
  it("rewrites the numbers of a sum that can't be read yet, one by one", () => {
    expect(rebase("12 + 0x", U64, 16)).toBe("C + 0x");
    expect(rebase("10 AND (", U64, 2)).toBe("1010 AND (");
  });
});

describe("values that don't fit the word keep their value (review C-12 #1)", () => {
  const S8h = { ...S8, base: 16 as const }, U8b = { ...U64, wordSize: 8 as const, base: 2 as const };
  it("a negative number unsigned, or one past the signed range, is written in decimal with its base", () => {
    expect(literal(-5n, { ...U64, base: 16 })).toBe("(−5₁₀)");
    expect(literal(-5n, U8b)).toBe("(−5₁₀)");
    expect(literal(200n, S8h)).toBe("200₁₀");
    expect(literal(-200n, S8h)).toBe("(−200₁₀)");
  });
  it("ones that fit, or can't be misread, are plain digits", () => {
    expect(literal(-5n, S8h)).toBe("FB");
    expect(literal(200n, { ...S8h, signed: false })).toBe("C8");
    expect(literal(300n, S8h)).toBe("12C");
    expect(literal(-5n, { ...U64, base: 10 })).toBe("(−5)");
  });
  it("reading it back gives the value or an error, never another number", () => {
    for (const wordSize of [8, 16, 32, 64] as const) for (const signed of [false, true]) for (const base of [2, 8, 10, 16] as const) {
      const o = { base, wordSize, signed };
      for (const v of [-5n, 5n, 200n, -200n, 300n, 40000n, -40000n, 1n << 31n, -(1n << 31n), (1n << 63n) + 1n, -(1n << 63n), 1n << 64n]) {
        const r = evaluateProgramming(literal(v, o), o);
        if ("exact" in r) expect(r.exact).toBe(v.toString());
        else expect(fitsWord(v, o)).toBe(false);
      }
    }
  });
});

describe("half-typed 0b (review C-12 #4)", () => {
  it("goes in hex (it would be the digits 0B) and isn't turned into 11 on the way back", () => {
    expect(rebase("12+0b", U64, 16)).toBe("C+");
    expect(rebase("0b12", U64, 16)).toBe("12₂");
    expect(rebase("0b", U64, 2)).toBe("0b");
  });
});

describe("sums from the other modes (review C-12 #2)", () => {
  it("whole-number sums carry over, ^ as **", () => {
    expect(toProgramming("10+5")).toBe("10+5");
    expect(toProgramming("2^3 mod 3 − ans")).toBe("2**3 mod 3 − ans");
    expect(toProgramming("6÷2")).toBe("6÷2");
    expect(toProgramming("2×(8÷4)")).toBe("2×(8÷4)");
    expect(toProgramming("10+")).toBe("10+");
  });
  it("sums whose answer would change (÷ is integer division here) are refused", () => {
    for (const s of ["1÷2", "7÷2", "1÷3×3", "10/4", "2×(3÷4)"]) expect(toProgramming(s), s).toBeNull();
  });
  it("names, decimals, scientific notation and other-meaning symbols are refused, not reinterpreted", () => {
    for (const s of ["2×e", "e^2", "2.5e3+1", "1e−7", "1E5", "a+1", "face+1", "0b", "π", "sin(30)", "50%", "|−5|", "3²", "2.5", "5!", "ans2"])
      expect(toProgramming(s), s).toBeNull();
  });
  it("programming sums go back in decimal, or are refused when the other modes can't hold them", () => {
    expect(fromProgramming("FF+1", { ...U64, base: 16 })).toBe("255+1");
    expect(fromProgramming("FB+0x10+10₈", { ...S8, base: 16 })).toBe("(−5)+16+8");
    expect(fromProgramming("2**3 mod ans", U64)).toBe("2^3 mod ans");
    for (const s of ["FF AND 1", "NOT 5", "1<<2", "5^3", "5%3", "ones(1)", "12+0x"]) expect(fromProgramming(s, { ...U64, base: 16 }), s).toBeNull();
  });
});
