import { describe, expect, it } from "vitest";
import { speak } from "../src/core/speak";

describe("speak: the display read as words", () => {
  it("names the operators", () => {
    expect(speak("2 × 3")).toBe("2 times 3");
    expect(speak("10 ÷ 4 − 1 + 2")).toBe("10 divided by 4 minus 1 plus 2");
    expect(speak("√9")).toBe("square root of 9");
    expect(speak("5²")).toBe("5 squared");
    expect(speak("2³⁰")).toBe("2 to the power 30");
    expect(speak("4⁻¹")).toBe("4 inverse");
    expect(speak("1.5×10^3")).toBe("1.5 times ten to the power 3");
    expect(speak("sin(30)")).toBe("sin open bracket 30 close bracket");
  });
  it("reads a leading or following minus as negative", () => {
    expect(speak("−5")).toBe("negative 5");
    expect(speak("3 × −2")).toBe("3 times negative 2");
    expect(speak("2×10^−3")).toBe("2 times ten to the power negative 3");
    expect(speak("2^−3")).toBe("2 to the power negative 3");
    expect(speak("(−2)")).toBe("open bracket negative 2 close bracket");
  });
  it("reads a minus after something that ends a number as a subtraction", () => {
    expect(speak("(2) − 3")).toBe("open bracket 2 close bracket minus 3");
    expect(speak("5² − 3")).toBe("5 squared minus 3");
    expect(speak("5³ − 3")).toBe("5 cubed minus 3");
    expect(speak("4⁻¹ − 1")).toBe("4 inverse minus 1");
    expect(speak("50% − 1")).toBe("50 percent minus 1");
    expect(speak("3! − 1")).toBe("3 factorial minus 1");
  });
  it("reads shifts and rotates, and keeps comparisons and bitwise words", () => {
    expect(speak("1 << 4")).toBe("1 shift left 4");
    expect(speak("256 >> 2")).toBe("256 shift right 2");
    expect(speak("3 < 4")).toBe("3 less than 4");
    expect(speak("5 > 2")).toBe("5 greater than 2");
    expect(speak("5 ROL 1")).toBe("5 rotate left 1");
    expect(speak("5 ror 1")).toBe("5 rotate right 1");
    expect(speak("6 AND 3 OR 1 XOR 2")).toBe("6 AND 3 OR 1 XOR 2");
  });
  it("leaves plain numbers alone", () => {
    expect(speak("1,234.5")).toBe("1,234.5");
    expect(speak("")).toBe("");
  });
});
