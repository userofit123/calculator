// The pure parts of the in-app updates (desktop and Android apps): comparing versions, checking what GitHub's release
// says before anything is downloaded, and the SHA-256 comparison. No DOM, no network: tested in test/releases.test.ts.
// The desktop app's main process and the Android plugin make the requests; this only judges the answers.

export const REPO = "userofit123/calculator";
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
/** Every file the updater may download sits under this address (GitHub then redirects to its file host). */
export const DOWNLOAD_BASE = `${REPO_URL}/releases/download/`;

const VERSION = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
/** "1.2.3" (or "v1.2.3") as numbers; anything else (pre-releases, junk) is null and never counts as an update. */
export function parseVersion(v: unknown): [number, number, number] | null {
  if (typeof v !== "string") return null;
  const m = VERSION.exec(v.trim().replace(/^v/, ""));
  return m ? [+m[1]!, +m[2]!, +m[3]!] : null;
}
/** Whether `a` is a later version than `b`. Unreadable versions are never newer, so a bad answer offers nothing. */
export function newer(a: unknown, b: unknown): boolean {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return false;
}

export const isSha256 = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s);
/** The download's SHA-256 against the expected one: both must be real hashes, compared without case. */
export function shaMatches(expected: unknown, actual: unknown): boolean {
  return isSha256(expected) && isSha256(actual) && expected.toLowerCase() === actual.toLowerCase();
}

/** android-latest.json, written by the release workflow: { version, url, sha256, size }. */
export interface AndroidManifest { version: string; url: string; sha256: string; size: number }
/** The largest APK the updater accepts (the real one is a few MB): a manifest claiming more is wrong. */
export const MAX_APK = 200 * 1024 * 1024;
/** Checks android-latest.json before anything is downloaded: a plain x.y.z version equal to the release's tag, the APK
 *  of exactly that version from this repository's own release downloads, a real SHA-256, and a sensible size. Returns
 *  the manifest, or why it was refused (then nothing is downloaded). */
export function checkAndroidManifest(j: unknown, tag: string): AndroidManifest | string {
  if (!j || typeof j !== "object") return "The update information is unreadable";
  const m = j as Record<string, unknown>;
  const version = typeof m.version === "string" ? m.version.trim() : "";
  if (!parseVersion(version)) return "The update has no valid version";
  if (version !== tag.replace(/^v/, "")) return "The update information doesn't match the release";
  if (m.url !== `${DOWNLOAD_BASE}v${version}/calculator-${version}.apk`) return "The update's download address is not this app's";
  if (!isSha256(m.sha256)) return "The update has no valid checksum";
  if (typeof m.size !== "number" || !Number.isInteger(m.size) || m.size <= 0 || m.size > MAX_APK) return "The update has no valid size";
  return { version, url: m.url, sha256: m.sha256.toLowerCase(), size: m.size };
}

/** What the app shows about the latest release (from GitHub's API: releases/latest). */
export interface ReleaseInfo { version: string; notes: string; page: string; manifestUrl?: string }
/** Reads GitHub's releases/latest answer. The release page must be this repository's (it is opened as a link); the
 *  android-latest.json address is kept only when it is this release's own file. */
export function readRelease(j: unknown): ReleaseInfo | string {
  if (!j || typeof j !== "object") return "GitHub's answer is unreadable";
  const r = j as { tag_name?: unknown; body?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
  if (r.draft || r.prerelease) return "No release yet";
  const tag = typeof r.tag_name === "string" ? r.tag_name : "";
  const version = tag.replace(/^v/, "");
  if (!parseVersion(version)) return "The latest release has no valid version";
  const page = typeof r.html_url === "string" && r.html_url.startsWith(`${REPO_URL}/releases/`) ? r.html_url : `${REPO_URL}/releases/tag/v${version}`;
  const want = `${DOWNLOAD_BASE}${tag}/android-latest.json`;
  const assets = Array.isArray(r.assets) ? (r.assets as { name?: unknown; browser_download_url?: unknown }[]) : [];
  const manifestUrl = assets.find((a) => a?.name === "android-latest.json" && a.browser_download_url === want) ? want : undefined;
  return { version, notes: plainNotes(r.body), page, manifestUrl };
}

/** The release notes as plain text: the body is Markdown written in CHANGELOG.md; it is shown as text (never as HTML),
 *  so tags are dropped and the Markdown marks that would only be noise are tidied. Kept to a readable length. */
export function plainNotes(body: unknown, max = 4000): string {
  if (typeof body !== "string") return "";
  let s = body.replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[–—]/g, "-")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + " ...";
  return s;
}
