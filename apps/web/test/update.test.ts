// The update logic's pure parts (apps/web/src/core/update.ts)
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { isEditing, isIdle, reloadDecision } from "../src/core/update";

describe("isIdle", () => {
  it("empty is idle", () => expect(isIdle({ expr: "", answer: "", sheet: false })).toBe(true));
  it("typing is busy", () => expect(isIdle({ expr: "12+", answer: "", sheet: false })).toBe(false));
  it("an answer showing is idle", () => expect(isIdle({ expr: "1+2", answer: "3", sheet: false })).toBe(true));
  it("an open sheet is busy", () => expect(isIdle({ expr: "", answer: "", sheet: true })).toBe(false));
  const base = { expr: "", answer: "", sheet: false };
  it("a focused text input is busy", () => expect(isIdle({ ...base, active: { tagName: "INPUT", type: "text" } })).toBe(false));
  it("a focused search/number input, textarea, select, contenteditable are busy", () => {
    for (const a of [{ tagName: "INPUT", type: "search" }, { tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }])
      expect(isIdle({ ...base, active: a })).toBe(false);
  });
  it("a focused checkbox, radio, range or button is not busy", () => {
    for (const type of ["checkbox", "radio", "range", "button"]) expect(isIdle({ ...base, active: { tagName: "INPUT", type } })).toBe(true);
    expect(isIdle({ ...base, active: { tagName: "BUTTON" } })).toBe(true);
    expect(isEditing(null)).toBe(false);
  });
  it("input within 5 s is busy, later is idle", () => {
    expect(isIdle({ ...base, lastInput: 10_000, now: 14_000 })).toBe(false);
    expect(isIdle({ ...base, lastInput: 10_000, now: 15_000 })).toBe(true);
    expect(isIdle({ ...base, lastInput: 0, now: 1 })).toBe(true);
  });
});

describe("reloadDecision", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("reloads once, then waits a minute", () => {
    const s = mem();
    expect(reloadDecision(() => s, 100_000)).toBe("reload");
    expect(reloadDecision(() => s, 130_000)).toBe("wait");
    expect(reloadDecision(() => s, 161_000)).toBe("reload");
  });
  it("never reloads when storage throws", () => {
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(reloadDecision(() => bad, 1)).toBe("unwritable");
    expect(reloadDecision(() => { throw new Error("denied"); }, 1)).toBe("unwritable");
  });
  it("never reloads when the stamp does not stick", () => {
    expect(reloadDecision(() => ({ getItem: () => null, setItem: () => {} }), 100_000)).toBe("unwritable");
  });
});
