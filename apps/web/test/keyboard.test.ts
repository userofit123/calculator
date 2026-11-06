// Keyboard mode (apps/web/src/core/keyboard.ts and the line bits of calc.ts). Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { startMode, recallStep, recallLines, freshRecall, type DeviceHints } from "../src/core/keyboard";
import { calc, enterLine, linePreview, settings } from "../src/core/calc";
import { history } from "../src/core/history";

const desk: DeviceHints = { phone: false, finePointer: true, anyCoarse: false };

describe("start mode", () => {
  it("a computer with a mouse and no touch screen starts in Keyboard", () => expect(startMode(null, desk)).toBe("keyboard"));
  it("a touch screen, a phone layout or an unknown pointer starts in Basic", () => {
    expect(startMode(null, { ...desk, anyCoarse: true })).toBe("basic");
    expect(startMode(null, { ...desk, phone: true })).toBe("basic");
    expect(startMode(null, { ...desk, finePointer: false })).toBe("basic");
  });
  it("a saved mode always wins", () => {
    expect(startMode("advanced", desk)).toBe("advanced");
    expect(startMode("keyboard", { phone: true, finePointer: false, anyCoarse: true })).toBe("keyboard");
  });
});

describe("line recall", () => {
  const lines = ["3+3", "2+2", "1+1"]; // newest first
  it("goes up through older lines and keeps the line being typed", () => {
    let st = freshRecall();
    const a = recallStep(lines, st, "9×", "up")!; st = a.st;
    expect(a.text).toBe("3+3");
    const b = recallStep(lines, st, a.text, "up")!; st = b.st;
    expect(b.text).toBe("2+2");
    const c = recallStep(lines, st, b.text, "down")!; st = c.st;
    expect(c.text).toBe("3+3");
    const d = recallStep(lines, st, c.text, "down")!; st = d.st;
    expect(d.text).toBe("9×");
    expect(recallStep(lines, st, d.text, "down")).toBeNull();
  });
  it("stops at the oldest line", () => {
    let st = freshRecall();
    for (let i = 0; i < 3; i++) st = recallStep(lines, st, "", "up")!.st;
    expect(recallStep(lines, st, "", "up")).toBeNull();
    expect(recallStep([], freshRecall(), "", "up")).toBeNull();
  });
  it("lists a line typed twice in a row once", () => expect(recallLines(["1+1", "1+1", "2", "", "1+1"])).toEqual(["1+1", "2", "1+1"]));
});

describe("a typed line", () => {
  it("works out free typing with * / - and the decimal mark, sets ans and goes into history", () => {
    expect(linePreview("2*(3-1)/4")).toBe("1");
    expect(enterLine("2*(3-1)/4")).toBe("");
    expect(calc.expr).toBe("2×(3−1)÷4");
    expect(calc.ans).toBe("1");
    expect(history[0]).toMatchObject({ e: "2×(3−1)÷4", r: "1", m: "keyboard" });
    expect(enterLine("ans + 1")).toBe("");
    expect(calc.ans).toBe("2");
  });
  it("assigns variables and uses them", () => {
    expect(enterLine("x = 5")).toBe("");
    expect(calc.vars.x).toBe("5");
    expect(enterLine("x^2")).toBe("");
    expect(calc.answer).toBe("25");
  });
  it("closes brackets left open and reports errors without changing the answer", () => {
    expect(enterLine("(1+2")).toBe("");
    expect(calc.expr).toBe("(1+2)");
    expect(enterLine("1/0")).not.toBe("");
    expect(calc.ans).toBe("3");
    expect(linePreview("2+")).toBe("");
  });
  it("reads the user's decimal comma", () => {
    settings.decimalMark = ",";
    try { expect(enterLine("1,5*2")).toBe(""); expect(calc.ans).toBe("3"); } finally { settings.decimalMark = "."; }
  });
});
