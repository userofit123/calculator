// The in-app updater's pure parts (apps/web/src/core/releases.ts)
import { describe, it, expect } from "vitest";
import { newer, parseVersion, shaMatches, isSha256, checkAndroidManifest, readRelease, plainNotes, DOWNLOAD_BASE, MAX_APK } from "../src/core/releases";

describe("versions", () => {
  it("reads x.y.z with or without v", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v10.0.12")).toEqual([10, 0, 12]);
    for (const bad of ["1.2", "1.2.3-beta", "", "a.b.c", null, 3]) expect(parseVersion(bad)).toBeNull();
  });
  it("compares by numbers, not text", () => {
    expect(newer("0.10.0", "0.9.9")).toBe(true);
    expect(newer("1.0.0", "1.0.0")).toBe(false);
    expect(newer("1.0.0", "1.0.1")).toBe(false);
    expect(newer("v2.0.0", "1.99.99")).toBe(true);
  });
  it("never offers an unreadable version", () => {
    expect(newer("2.0.0-rc1", "1.0.0")).toBe(false);
    expect(newer("2.0.0", "dev")).toBe(false);
  });
});

const SHA = "a".repeat(64);
describe("sha check", () => {
  it("matches without case, only real hashes", () => {
    expect(shaMatches(SHA, SHA.toUpperCase())).toBe(true);
    expect(shaMatches(SHA, "b".repeat(64))).toBe(false);
    expect(shaMatches("", "")).toBe(false);
    expect(shaMatches("abc", "abc")).toBe(false);
    expect(isSha256("g".repeat(64))).toBe(false);
  });
});

describe("android-latest.json", () => {
  const good = { version: "1.2.0", url: `${DOWNLOAD_BASE}v1.2.0/calculator-1.2.0.apk`, sha256: SHA.toUpperCase(), size: 4_200_000 };
  it("accepts the workflow's manifest", () => {
    expect(checkAndroidManifest(good, "v1.2.0")).toEqual({ ...good, sha256: SHA });
  });
  it("refuses a version that isn't the release's", () => {
    expect(typeof checkAndroidManifest(good, "v1.3.0")).toBe("string");
    expect(typeof checkAndroidManifest({ ...good, version: "1.2" }, "v1.2")).toBe("string");
  });
  it("refuses a download from anywhere else", () => {
    for (const url of ["https://example.com/calculator-1.2.0.apk", `${DOWNLOAD_BASE}v1.2.0/other.apk`, `http://github.com/userofit123/calculator/releases/download/v1.2.0/calculator-1.2.0.apk`, `${DOWNLOAD_BASE}v1.1.0/calculator-1.2.0.apk`])
      expect(typeof checkAndroidManifest({ ...good, url }, "v1.2.0")).toBe("string");
  });
  it("refuses a missing checksum or a wrong size", () => {
    expect(typeof checkAndroidManifest({ ...good, sha256: "" }, "v1.2.0")).toBe("string");
    for (const size of [0, -1, 1.5, "4200000", MAX_APK + 1]) expect(typeof checkAndroidManifest({ ...good, size }, "v1.2.0")).toBe("string");
    expect(typeof checkAndroidManifest(null, "v1.2.0")).toBe("string");
  });
});

describe("GitHub's releases/latest", () => {
  const tag = "v1.2.0";
  const rel = { tag_name: tag, body: "## Added\n- **Updates** in the apps", html_url: "https://github.com/userofit123/calculator/releases/tag/v1.2.0",
    assets: [{ name: "android-latest.json", browser_download_url: `${DOWNLOAD_BASE}${tag}/android-latest.json` }] };
  it("reads version, notes, page and the manifest address", () => {
    expect(readRelease(rel)).toEqual({ version: "1.2.0", notes: "Added\n- Updates in the apps", page: rel.html_url, manifestUrl: `${DOWNLOAD_BASE}${tag}/android-latest.json` });
  });
  it("never takes a page or manifest from elsewhere", () => {
    const r = readRelease({ ...rel, html_url: "https://evil.example/", assets: [{ name: "android-latest.json", browser_download_url: "https://evil.example/a.json" }] });
    expect(r).toMatchObject({ page: "https://github.com/userofit123/calculator/releases/tag/v1.2.0", manifestUrl: undefined });
  });
  it("skips drafts, pre-releases and bad tags", () => {
    expect(typeof readRelease({ ...rel, prerelease: true })).toBe("string");
    expect(typeof readRelease({ ...rel, tag_name: "nightly" })).toBe("string");
    expect(typeof readRelease("x")).toBe("string");
  });
});

describe("release notes as plain text", () => {
  it("drops HTML and Markdown noise", () => {
    expect(plainNotes('<img src=x onerror="alert(1)">Fixed <b>it</b> - see [the docs](https://x)')).toBe("Fixed it - see the docs");
    expect(plainNotes("* one\n+ two\n\n\n\n`code` — dash")).toBe("- one\n- two\n\ncode - dash");
    expect(plainNotes(undefined)).toBe("");
  });
  it("keeps a readable length", () => {
    expect(plainNotes("word ".repeat(2000), 100).length).toBeLessThanOrEqual(104);
  });
});
