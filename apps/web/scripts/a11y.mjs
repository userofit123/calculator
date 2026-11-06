// Accessibility check: loads the running app (the dev server, or a built copy served elsewhere) in a headless Firefox of
// its own (own profile, own Marionette port) and runs axe-core on every screen: each calculator mode, the converter,
// history, settings and the Appearance panel, on the computer and the phone layout. Never part of the app's bundle.
//   node apps/web/scripts/a11y.mjs [http://127.0.0.1:8795] [--zoom 2 | --text 2] [--hc] [--shots dir] [--json]
// --zoom 2: 200% page zoom (the window's CSS size halved, everything drawn twice as large: a 1280px window is 640 CSS px
// wide, the phone 320, WCAG's reflow width); --text 2: text only at 200% (Firefox's system text scale applied to text
// alone, like Android's font size in the WebView). Both also report anything cut off or running off the page.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:8795").replace(/\/$/, "");
const zi = args.indexOf("--zoom"), ZOOM = zi >= 0 ? Number(args[zi + 1]) : 1;
const HC = args.includes("--hc"); // high contrast: Firefox's own colours forced on the page (forced-colors: active)
const ti = args.indexOf("--text"), TEXT = ti >= 0 ? Number(args[ti + 1]) : 1;
const JSON_OUT = args.includes("--json");
const si = args.indexOf("--shots"), SHOTS = si >= 0 ? args[si + 1] : "";
const PORT = 2900 + Math.floor(Math.random() * 500);
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const profile = mkdtempSync(join(tmpdir(), "calc-a11y-"));
writeFileSync(join(profile, "user.js"), [
  `user_pref("marionette.port", ${PORT});`,
  `user_pref("browser.shell.checkDefaultBrowser", false);`,
  `user_pref("datareporting.policy.dataSubmissionEnabled", false);`,
  `user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);`,
  ZOOM !== 1 ? `user_pref("layout.css.devPixelsPerPx", "${ZOOM}");` : "",
  HC ? `user_pref("browser.display.document_color_use", 2);` : "",
  TEXT !== 1 ? `user_pref("ui.textScaleFactor", ${Math.round(TEXT * 100)});\nuser_pref("browser.display.os-zoom-behavior", 2);` : "",
].join("\n"));
const ff = spawn("firefox", ["--headless", "--marionette", "--no-remote", "--profile", profile, "-width", "1280", "-height", "900"], { stdio: "ignore" });
const cleanup = () => { try { ff.kill(); } catch { /* gone */ } setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); };

// --- a minimal Marionette client: "len:json" frames, [0, id, command, params] → [1, id, error, result]
let sock, buf = "", id = 0;
const waiting = new Map();
function onData(d) {
  buf += d;
  for (;;) {
    const c = buf.indexOf(":"); if (c < 0) return;
    const n = Number(buf.slice(0, c));
    if (Buffer.byteLength(buf.slice(c + 1)) < n) return;
    // lengths are in bytes: cut by bytes
    const rest = Buffer.from(buf.slice(c + 1)), msg = rest.subarray(0, n).toString(); buf = rest.subarray(n).toString();
    const m = JSON.parse(msg);
    if (Array.isArray(m) && m[0] === 1) { const w = waiting.get(m[1]); waiting.delete(m[1]); m[2] ? w.reject(new Error(JSON.stringify(m[2]).slice(0, 400))) : w.resolve(m[3]); }
  }
}
const cmd = (name, params = {}) => new Promise((resolve, reject) => {
  const i = ++id, s = JSON.stringify([0, i, name, params]);
  waiting.set(i, { resolve, reject }); sock.write(`${Buffer.byteLength(s)}:${s}`);
});
async function connect() {
  for (let t = 0; t < 100; t++) {
    try {
      await new Promise((res, rej) => { sock = net.connect(PORT, "127.0.0.1", res); sock.once("error", rej); });
      sock.setEncoding("utf8"); sock.on("data", onData);
      await new Promise((r) => setTimeout(r, 300));
      return;
    } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("Marionette did not start");
}
const js = async (script, a = []) => (await cmd("WebDriver:ExecuteScript", { script, args: a })).value;
const ajs = async (script, a = []) => (await cmd("WebDriver:ExecuteAsyncScript", { script, args: a })).value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(path, store) {
  await cmd("WebDriver:Navigate", { url: BASE + "/" });
  await js(`localStorage.clear(); for (const [k, v] of Object.entries(arguments[0])) localStorage.setItem(k, v);`, [store]);
  await cmd("WebDriver:Navigate", { url: BASE + path });
  await sleep(1300);
}
async function axe() {
  if (!(await js("return !!window.axe"))) await js(AXE + "\n;return true;");
  return ajs(`const done = arguments[arguments.length - 1];
    axe.run(document, { resultTypes: ["violations"] }).then((r) => done(r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 6), count: v.nodes.length }))), (e) => done([{ id: "axe-error", help: String(e), nodes: [], count: 1 }]));`);
}
// at 200%: anything wider than the page, and text cut off inside its box (keys, chips, rows, tabs)
const overflow = () => js(`const out = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push("page scrolls sideways: " + document.documentElement.scrollWidth + " > " + innerWidth);
  for (const el of document.querySelectorAll("button, .key, .chip, label, .row, [role=tab], h1, h2, h3, p, span")) {
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || !el.offsetWidth) continue;
    if (el.closest(".cexp, .cres, .pval, .num, .sr, [aria-hidden=true], .tst")) continue; // long numbers scroll or shrink on purpose
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 && !el.closest(".cvc, .tabs, [data-noswipe], .klist, .mnu, .ddm")) out.push("off the right edge: " + (el.className || el.tagName) + " '" + el.textContent.trim().slice(0, 30) + "'");
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && (el.children.length === 0 || el.matches(".key, .cflag, .seg button, .tabbar button, .nb, .btn, .cvchip"))) out.push("cut off: " + (el.className || el.tagName) + " '" + el.textContent.trim().slice(0, 30) + "' " + el.scrollWidth + ">" + el.clientWidth);
  }
  return [...new Set(out)].slice(0, 15);`);

const DESK = { calcLayout: "desktop" }, PHONE = { calcLayout: "phone" };
const MODES = ["basic", "advanced", "financial", "programming", "keyboard", "date", "everyday"];
const scenes = [];
for (const m of MODES) scenes.push({ name: `calc ${m}`, path: "/", store: { ...DESK, calcMode: JSON.stringify(m), calcSettings: JSON.stringify({ everyday: true }) } });
scenes.push({ name: "calc basic (answer)", path: "/", store: { ...DESK, calcMode: '"basic"' }, run: `for (const k of ["2","×","3","="]) [...document.querySelectorAll(".keys .key")].find((b) => b.textContent.trim() === k).click();`,
  check: `return [document.querySelector(".calc > [aria-live]").textContent, document.querySelector(".cres").getAttribute("aria-label"), document.querySelector(".cexp .sr")?.textContent].join(" | ")` });
scenes.push({ name: "calc mode menu", path: "/", store: { ...DESK, calcMode: '"basic"' }, run: `document.querySelector(".mnub").click();` });
scenes.push({ name: "calc number format", path: "/", store: { ...DESK, calcMode: '"basic"' }, run: `document.querySelectorAll(".cbar .cflag")[1].click();` });
scenes.push({ name: "variables sheet", path: "/", store: { ...DESK, calcMode: '"advanced"' }, run: `document.querySelector(".cvars").focus(); document.querySelector(".cvars").click();`,
  check: `const d = document.querySelector(".sht[role=dialog]"); return "modal=" + d?.getAttribute("aria-modal") + " focus in sheet=" + d?.contains(document.activeElement) + " (" + document.activeElement?.className + ")"` });
scenes.push({ name: "mode menu keyboard", path: "/", store: { ...DESK, calcMode: '"basic"' }, run: `document.querySelector(".mnub").focus(); document.querySelector(".mnub").click();`,
  check: `const a = document.activeElement; a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); const b = document.activeElement.textContent; document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "start=" + a.getAttribute("role") + ":" + a.textContent.slice(0, 8) + " next=" + b.slice(0, 8) + " after Esc focus=" + document.activeElement.className + " open=" + !!document.querySelector(".mnu")` });
scenes.push({ name: "converter", path: "/converter", store: DESK });
scenes.push({ name: "history", path: "/history", store: { ...DESK, calcHistory: JSON.stringify([{ t: Date.now(), e: "2×3", r: "6", x: "6" }]) } });
scenes.push({ name: "settings", path: "/settings", store: DESK });
scenes.push({ name: "appearance", path: "/", store: DESK, run: `document.querySelector("#themeBtn").click();` });
for (const m of ["basic", "advanced", "programming"]) scenes.push({ name: `phone calc ${m}`, phone: true, path: "/", store: { ...PHONE, calcMode: JSON.stringify(m) } });
scenes.push({ name: "phone converter", phone: true, path: "/converter", store: PHONE });
scenes.push({ name: "phone settings", phone: true, path: "/settings", store: PHONE });

let total = 0;
const report = [];
try {
  await connect();
  await cmd("WebDriver:NewSession", { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
  await cmd("WebDriver:SetTimeouts", { script: 60000, pageLoad: 30000 });
  for (const s of scenes) {
    await cmd("WebDriver:SetWindowRect", s.phone ? { width: ZOOM !== 1 ? 320 : 400, height: Math.round(860 / ZOOM) } : { width: Math.round(1280 / ZOOM), height: Math.round(900 / ZOOM) });
    await open(s.path, s.store);
    if (s.run) { await js(s.run); await sleep(1300); }
    if (s.check) console.log(`  > ${await js(s.check)}`);
    if (process.env.A11Y_EVAL) console.log(`  ? ${await js(process.env.A11Y_EVAL)}`);
    const v = await axe();
    const o = ZOOM !== 1 || TEXT !== 1 ? await overflow() : [];
    const n = v.reduce((a, x) => a + x.count, 0);
    if (SHOTS) writeFileSync(join(SHOTS, s.name.replace(/\W+/g, "-") + ".png"), Buffer.from((await cmd("WebDriver:TakeScreenshot", { full: false })).value, "base64"));
    total += n;
    report.push({ scene: s.name, violations: v, overflow: o });
    if (!JSON_OUT) {
      console.log(`${s.name}: ${v.length} rules, ${n} nodes${o.length ? `, ${o.length} layout issues` : ""}`);
      for (const x of v) console.log(`  - ${x.id} (${x.impact}, ${x.count}): ${x.help} :: ${x.nodes.join(" | ")}`);
      for (const x of o) console.log(`  ~ ${x}`);
    }
  }
  if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
  console.log(`TOTAL violation nodes: ${total}`);
  await cmd("WebDriver:DeleteSession").catch(() => {});
} catch (e) {
  console.error(e); process.exitCode = 2;
} finally { sock?.destroy(); cleanup(); }
