import { describe, expect, it } from "vitest";
import { evaluate } from "../src";

describe("evaluate (stub)", () => {
  it("adds decimals exactly", () => expect(evaluate("0.1 + 0.2")).toEqual({ value: "0.3" }));
  it("uses the calculator signs and precedence", () => expect(evaluate("2 + 3 × 4 − 6 ÷ 4")).toEqual({ value: "12.5" }));
  it("handles brackets and unary minus", () => expect(evaluate("-(2 + 3) * -2")).toEqual({ value: "10" }));
  it("rounds long answers", () => expect(evaluate("1 ÷ 3")).toEqual({ value: "0.333333333333" }));
  it("reports division by zero", () => expect(evaluate("5 ÷ 0")).toEqual({ error: "Can't divide by zero" }));
  it("reports an unfinished expression", () => expect("error" in evaluate("5 +")).toBe(true));
});
