// Starts a new version: sets it in the package.json files and turns CHANGELOG.md's "## Unreleased" section into
// "## [x.y.z] - date" (or adds an empty one at the top to fill in). Merging that CHANGELOG.md to main publishes it.
//   node scripts/bump.mjs 0.2.0
// The web app reads the root package.json version; the Android app gets it from the release workflow (-PappVersion).
import fs from "node:fs";
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v ?? "")) { console.error("usage: node scripts/bump.mjs <x.y.z>"); process.exit(1); }
const root = new URL("../", import.meta.url);
for (const p of ["package.json", "apps/web/package.json", "apps/desktop/package.json", "apps/android/package.json"]) {
  const f = new URL(p, root), j = JSON.parse(fs.readFileSync(f, "utf8"));
  // only files that carry a version (root and desktop); the others take it from the root
  if (j.version === undefined) continue;
  j.version = v; fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
}
const cf = new URL("CHANGELOG.md", root);
const c = fs.readFileSync(cf, "utf8");
if (new RegExp(`^## \\[${v.replace(/\./g, "\\.")}\\]`, "m").test(c)) { console.error(`CHANGELOG.md already has ${v}`); process.exit(1); }
const heading = `## [${v}] - ${new Date().toISOString().slice(0, 10)}`;
let out;
const unreleased = /^## Unreleased[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(c);
// an empty Unreleased section still gets a "- " line to fill in
if (unreleased) out = c.replace(/^## Unreleased[^\n]*$/m, `## Unreleased\n\n${heading}${unreleased[1].trim() ? "" : "\n\n- "}`);
else if (/^## \[/m.test(c)) out = c.replace(/^## \[/m, `${heading}\n\n- \n\n## [`);
else out = c.trimEnd() + `\n\n${heading}\n\n- \n`;
fs.writeFileSync(cf, out);
console.log(`Version ${v}: check its section in CHANGELOG.md, then merge to main to publish.`);
