// C-66: Everyday mode's tools are modes of their own (Percent, Discount, Tip & Split), VAT is gone, and chosen modes
// can be shortcuts next to the mode menu. Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
// a saved Everyday mode on its Discount tab (with the retired VAT fields), the old "everyday: false" switch still in
// the saved settings, and shortcuts saved with a mode this version doesn't have
const store = vi.hoisted(() => {
  const m = new Map<string, string>([
    ["calcMode", JSON.stringify("everyday")],
    ["everydayCalc", JSON.stringify({ tab: "discount", price: "80", amount: "100", rate: "19", vatRemove: true })],
    ["calcSettings", JSON.stringify({ everyday: false, decimals: 4 })],
    ["calcShortcuts", JSON.stringify({ on: true, modes: ["discount", "everyday", "date", "discount"] })],
  ]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  return m;
});
import { nextTick } from "vue";
import { calc, settings, formMode, MODES, shortcuts, toggleShortcut, moveShortcut, SHORTCUT_DEFAULT } from "../src/core/calc";

describe("Everyday mode's saved state", () => {
  it("a saved Everyday mode opens on its last tab's mode, saved at once, and the old switch is ignored", () => {
    expect(calc.mode).toBe("discount");
    expect(JSON.parse(store.get("calcMode")!)).toBe("discount");
    expect(settings.decimals).toBe(4);
    expect("everyday" in settings).toBe(false);
  });
});

describe("the mode list", () => {
  const ids = MODES.map((m) => m.id) as string[];
  it("has Percent, Discount and Tip & Split after Date, and no Everyday", () => {
    expect(ids.slice(ids.indexOf("date"))).toEqual(["date", "percent", "discount", "tip"]);
    expect(ids).not.toContain("everyday");
  });
  it("their forms take the place of the keys, like Date", () => {
    for (const m of ["percent", "discount", "tip", "date"] as const) expect(formMode(m)).toBe(true);
    expect(formMode("basic")).toBe(false);
  });
  it("a mode stays chosen", async () => {
    calc.mode = "tip"; await nextTick();
    expect(calc.mode).toBe("tip");
    calc.mode = "basic"; await nextTick();
  });
});

describe("mode shortcuts", () => {
  it("default to Tip & Split, Discount and Percent", () => { expect(SHORTCUT_DEFAULT).toEqual(["tip", "discount", "percent"]); });
  it("a saved list keeps only modes there are, once each, in order", () => { expect(shortcuts.modes).toEqual(["discount", "date"]); });
  it("are added at the end, moved, taken away and saved", async () => {
    toggleShortcut("percent");
    expect(shortcuts.modes).toEqual(["discount", "date", "percent"]);
    moveShortcut("percent", -1);
    expect(shortcuts.modes).toEqual(["discount", "percent", "date"]);
    moveShortcut("discount", -1);
    expect(shortcuts.modes).toEqual(["discount", "percent", "date"]);
    toggleShortcut("date");
    shortcuts.on = false;
    await nextTick();
    expect(JSON.parse(store.get("calcShortcuts")!)).toEqual({ on: false, modes: ["discount", "percent"] });
  });
});
