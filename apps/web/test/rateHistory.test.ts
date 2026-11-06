// The rate graph's data loader: a request made while a fetch runs is kept and run after it (coalesced), not dropped.
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  Object.assign(globalThis, { addEventListener: () => {}, removeEventListener: () => {} });
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { ensureHistory, history } from "../src/core/rateHistory";

const csv = (cs: string[]) => "CURRENCY,TIME_PERIOD,OBS_VALUE\n" + cs.map((c) => `${c},2026-11-05,1.5`).join("\n");

describe("ensureHistory", () => {
  it("runs the latest request made during a fetch, once, after it", async () => {
    const urls: string[] = [];
    const gates: (() => void)[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      const cs = ["USD", "GBP", "CHF", "JPY"].filter((c) => url.includes(c));
      return new Promise((res) => gates.push(() => res({ ok: true, text: async () => csv(cs) })));
    });
    const first = ensureHistory(["USD"], "2026-10-06");
    expect(history.loading).toBe(true);
    void ensureHistory(["GBP"], "2026-10-06"); // superseded
    void ensureHistory(["CHF"], "2025-11-06"); // the latest wins
    expect(urls.length).toBe(1);
    gates[0]!();
    await vi.waitFor(() => expect(urls.length).toBe(2));
    expect(urls[1]).toContain("CHF");
    expect(urls[1]).not.toContain("GBP");
    gates[1]!();
    await first;
    expect(history.loading).toBe(false);
    expect(history.held.USD).toBeTruthy();
    expect(history.held.CHF!.from).toBe("2025-11-06");
    expect(history.held.GBP).toBeUndefined();
    expect(urls.length).toBe(2);
    vi.unstubAllGlobals();
  });
});
