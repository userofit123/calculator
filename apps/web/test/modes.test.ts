// C-66: Everyday mode's tools are modes of their own (Percent, Discount, Tip & Split), VAT is gone, and the tools are
// tabs next to the calculator's tab, whose menu holds only the calculator types. Run with the core's runner:
//   ./scripts/pnpm.sh --filter @calc/core exec vitest run --dir ../../apps/web/test
import { describe, it, expect, vi } from "vitest";
// a saved Everyday mode on its Discount tab (with the retired VAT fields), the old "everyday: false" switch still in
// the saved settings, the retired shortcut list, and Advanced as the calculator type used before
const store = vi.hoisted(() => {
  const m = new Map<string, string>([
    ["calcMode", JSON.stringify("everyday")],
    ["everydayCalc", JSON.stringify({ tab: "discount", price: "80", amount: "100", rate: "19", vatRemove: true })],
    ["calcSettings", JSON.stringify({ everyday: false, decimals: 4 })],
    ["calcShortcuts", JSON.stringify({ on: true, modes: ["discount", "date"] })],
    ["calcType", JSON.stringify("advanced")],
  ]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  return m;
});
import { nextTick } from "vue";
import { calc, settings, formMode, MODES, CALC_TYPES, TOOLS, lastType } from "../src/core/calc";

describe("Everyday mode's saved state", () => {
  it("a saved Everyday mode opens on its last tab's mode, saved at once, and the old switch is ignored", () => {
    expect(calc.mode).toBe("discount");
    expect(JSON.parse(store.get("calcMode")!)).toBe("discount");
    expect(settings.decimals).toBe(4);
    expect("everyday" in settings).toBe(false);
  });
});

describe("the mode list", () => {
  const ids = (l: { id: string }[]) => l.map((m) => m.id);
  it("the calculator's menu has only the calculator types", () => {
    expect(ids(CALC_TYPES)).toEqual(["basic", "advanced", "financial", "programming", "keyboard"]);
  });
  it("the tools are tabs in this order, and there is no Everyday", () => {
    expect(ids(TOOLS)).toEqual(["tip", "discount", "percent", "date"]);
    expect(ids(MODES)).toEqual([...ids(CALC_TYPES), ...ids(TOOLS)]);
    expect(ids(MODES)).not.toContain("everyday");
  });
  it("the tools' forms take the place of the keys", () => {
    for (const m of TOOLS) expect(formMode(m.id)).toBe(true);
    for (const m of CALC_TYPES) expect(formMode(m.id)).toBe(false);
  });
  it("the retired shortcut list is dropped from the device", () => { expect(store.has("calcShortcuts")).toBe(false); });
});

describe("the calculator tab", () => {
  it("opened on a tool, goes back to the type used before it", () => { expect(lastType.value).toBe("advanced"); });
  it("follows the type chosen, not the tools, and keeps it on the device", async () => {
    calc.mode = "financial"; await nextTick();
    calc.mode = "tip"; await nextTick();
    expect(calc.mode).toBe("tip");
    expect(lastType.value).toBe("financial");
    expect(JSON.parse(store.get("calcType")!)).toBe("financial");
  });
});
