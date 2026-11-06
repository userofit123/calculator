// The in-app update check's pure parts (apps/web/src/core/appUpdate.ts): when an automatic check is due, and which
// answers count as a made check rather than a failure
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { checkDue, nothingNew, EVERY, RETRY_GAP, NO_RELEASE, NO_ANDROID } from "../src/core/appUpdate";
import { readRelease } from "../src/core/releases";

describe("checkDue", () => {
  const now = 100 * EVERY;
  it("never when automatic checks are off", () => expect(checkDue({ auto: false, lastCheck: 0, lastFail: 0 }, now)).toBe(false));
  it("never checked: due", () => expect(checkDue({ auto: true, lastCheck: 0, lastFail: 0 }, now)).toBe(true));
  it("checked less than 6 hours ago: not due; 6 hours or more: due", () => {
    expect(checkDue({ auto: true, lastCheck: now - EVERY + 1, lastFail: 0 }, now)).toBe(false);
    expect(checkDue({ auto: true, lastCheck: now - EVERY, lastFail: 0 }, now)).toBe(true);
  });
  it("a failed check holds off the next automatic one for RETRY_GAP (repeated 'online' events don't re-check)", () => {
    expect(RETRY_GAP).toBeGreaterThanOrEqual(15 * 60_000);
    expect(checkDue({ auto: true, lastCheck: 0, lastFail: now - 1000 }, now)).toBe(false);
    expect(checkDue({ auto: true, lastCheck: 0, lastFail: now - RETRY_GAP + 1 }, now)).toBe(false);
    expect(checkDue({ auto: true, lastCheck: 0, lastFail: now - RETRY_GAP }, now)).toBe(true);
  });
  it("a recent made check still wins over an old failure", () => expect(checkDue({ auto: true, lastCheck: now - 60_000, lastFail: now - 2 * RETRY_GAP }, now)).toBe(false));
});

describe("nothingNew", () => {
  it("no release yet / no Android update are answers, not failures", () => {
    expect(nothingNew(NO_RELEASE)).toBe(true);
    expect(nothingNew(NO_ANDROID)).toBe(true);
  });
  it("a pre-release or draft as latest reads as no release yet", () => {
    expect(readRelease({ tag_name: "v9.0.0", prerelease: true })).toBe(NO_RELEASE);
    expect(readRelease({ tag_name: "v9.0.0", draft: true })).toBe(NO_RELEASE);
  });
  it("network and server problems are failures", () => {
    for (const m of ["Could not reach GitHub", "GitHub is busy, try again later", "GitHub's answer is unreadable", ""]) expect(nothingNew(m)).toBe(false);
  });
});
