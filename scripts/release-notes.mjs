// Prints the CHANGELOG.md section for a version (the release notes).
//   node scripts/release-notes.mjs 0.2.0
import fs from "node:fs";
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v ?? "")) { console.error("usage: node scripts/release-notes.mjs <x.y.z>"); process.exit(1); }
const text = fs.readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const m = new RegExp(`^## \\[${v.replace(/\./g, "\\.")}\\][^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m").exec(text);
process.stdout.write((m?.[1] ?? "").trim() + "\n");
