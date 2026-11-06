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
  });
  it("leaves plain numbers alone", () => {
    expect(speak("1,234.5")).toBe("1,234.5");
    expect(speak("")).toBe("");
  });
});
