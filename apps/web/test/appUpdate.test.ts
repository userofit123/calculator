// The in-app update check's pure parts (apps/web/src/core/appUpdate.ts): when an automatic check is due, and which
// answers count as a made check rather than a failure
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { checkDue, autoDownloadDue, nothingNew, EVERY, GAP, EVERY_CHOICES, RETRY_GAP, NO_RELEASE, NO_ANDROID } from "../src/core/appUpdate";
import { readRelease, shareOf, pctOf, progressText } from "../src/core/releases";
import { tMsg, knownMsg } from "../src/core/msg";

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

describe("How often (C-52)", () => {
  const now = 1000 * GAP.week;
  const base = { auto: true, lastFail: 0, checkedThisRun: false };
  it("offers Motus's 6 hours as the default and the other choices", () => {
    expect(EVERY).toBe(6 * 3600_000);
    expect(EVERY_CHOICES).toEqual(["open", "6h", "day", "week"]);
  });
  it("6 hours / a day / a week since the last check that got an answer", () => {
    for (const e of ["6h", "day", "week"] as const) {
      expect(checkDue({ ...base, every: e, lastCheck: now - GAP[e] + 1 }, now)).toBe(false);
      expect(checkDue({ ...base, every: e, lastCheck: now - GAP[e] }, now)).toBe(true);
    }
    expect(checkDue({ ...base, every: "week", lastCheck: now - GAP.day * 2 }, now)).toBe(false);
  });
  it("every time the app opens: once per run, however recent the last check", () => {
    expect(checkDue({ ...base, every: "open", lastCheck: now - 1000 }, now)).toBe(true);
    expect(checkDue({ ...base, every: "open", lastCheck: now - 1000, checkedThisRun: true }, now)).toBe(false);
  });
  it("off, or just after a failure: never", () => {
    for (const e of EVERY_CHOICES) {
      expect(checkDue({ ...base, auto: false, every: e, lastCheck: 0 }, now)).toBe(false);
      expect(checkDue({ ...base, every: e, lastCheck: 0, lastFail: now - 1 }, now)).toBe(false);
    }
  });
});

describe("autoDownloadDue (C-52)", () => {
  const now = 10 * RETRY_GAP;
  const s = { auto: true, autoDownload: true, latest: "1.2.0", mode: "install" as const, ready: false, downloading: false, wifiOnly: false, metered: null, lastFail: 0 };
  it("downloads what a check found when both switches are on", () => expect(autoDownloadDue(s, now)).toBe(true));
  it("not when either switch is off, nothing was found, or the copy updates from the release page", () => {
    expect(autoDownloadDue({ ...s, auto: false }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, autoDownload: false }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, latest: "" }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, mode: "link" }, now)).toBe(false);
  });
  it("not twice: ready or running", () => {
    expect(autoDownloadDue({ ...s, ready: true }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, downloading: true }, now)).toBe(false);
  });
  it("Only on Wi-Fi waits on mobile data; a device that can't tell doesn't wait", () => {
    expect(autoDownloadDue({ ...s, wifiOnly: true, metered: true }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, wifiOnly: true, metered: false }, now)).toBe(true);
    expect(autoDownloadDue({ ...s, wifiOnly: true, metered: null }, now)).toBe(true);
    expect(autoDownloadDue({ ...s, wifiOnly: false, metered: true }, now)).toBe(true);
  });
  it("a failed download waits RETRY_GAP", () => {
    expect(autoDownloadDue({ ...s, lastFail: now - RETRY_GAP + 1 }, now)).toBe(false);
    expect(autoDownloadDue({ ...s, lastFail: now - RETRY_GAP }, now)).toBe(true);
  });
});

describe("download progress (C-52)", () => {
  it("shareOf: bytes over size, capped at 1; unknown or nonsense sizes are null", () => {
    expect(shareOf(50, 200)).toBe(0.25);
    expect(shareOf(300, 200)).toBe(1);
    for (const [a, b] of [[1, 0], [1, -5], [-1, 10], [Number.NaN, 10], [1, Infinity], ["1", 10], [1, undefined]]) expect(shareOf(a, b)).toBeNull();
  });
  it("pctOf: whole percent rounded down, 100 only when complete, clamped", () => {
    expect(pctOf(0)).toBe(0);
    expect(pctOf(0.426)).toBe(42);
    expect(pctOf(0.999)).toBe(99);
    expect(pctOf(1)).toBe(100);
    expect(pctOf(1.5)).toBe(100);
    expect(pctOf(-0.2)).toBe(0);
    expect(pctOf(Number.NaN)).toBe(0);
  });
  it("progressText: percent, else megabytes so far, else plain; all of them translatable", () => {
    expect(progressText(0.42)).toBe("Downloading 42%");
    expect(progressText(null, 3_140_000)).toBe("Downloading 3.1 MB");
    expect(progressText(null)).toBe("Downloading");
    expect(progressText(null, Number.NaN)).toBe("Downloading");
    for (const m of [progressText(0.42), progressText(null, 3_140_000), progressText(null)]) expect(knownMsg(m)).toBe(true);
    expect(tMsg("Downloading 3.1 MB")).toBe("Downloading 3.1 MB");
  });
});
