// The update logic's pure parts (apps/web/src/core/update.ts)
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { isIdle, reloadDecision } from "../src/core/update";

describe("isIdle", () => {
  it("empty is idle", () => expect(isIdle({ expr: "", answer: "", sheet: false })).toBe(true));
  it("typing is busy", () => expect(isIdle({ expr: "12+", answer: "", sheet: false })).toBe(false));
  it("an answer showing is idle", () => expect(isIdle({ expr: "1+2", answer: "3", sheet: false })).toBe(true));
  it("an open sheet is busy", () => expect(isIdle({ expr: "", answer: "", sheet: true })).toBe(false));
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
