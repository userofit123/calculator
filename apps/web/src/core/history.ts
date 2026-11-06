// Past calculations, newest first, kept only on this device (at most 200). Small and in the main bundle because the
// calculator writes to it on every =; the History page that lists it loads lazily.
import { reactive } from "vue";
import { storable } from "@calc/core";
import { readJson, writeJson } from "./prefs";

/** e: the expression as typed, r: the answer as shown then (decimal "."), x: the answer in full (for reuse),
 *  b, w, s: the base, word size and signed setting of a programming-mode sum (its digits mean nothing without the base,
 *  and FF + 1 or NOT 0 give another answer in another word size or sign; x is decimal) */
export interface HistItem { e: string; r: string; x: string; t: number; b?: number; w?: number; s?: boolean; m?: string; p?: boolean }
// m: the mode it was worked out in (added later, so older entries have none; a programming one is known by b), p: pinned
/** A programming-mode sum's settings */
export interface HistProg { base: number; wordSize: number; signed: boolean }
const MAX = 200;

/** Newest first, the cap applies to the unpinned ones only: a pinned entry stays until it is unpinned or deleted */
export function capHistory(items: HistItem[], max = MAX): HistItem[] {
  let n = 0;
  return items.filter((h) => h.p || ++n <= max);
}

export const history = reactive<HistItem[]>(capHistory(readJson<HistItem[]>("calcHistory", [])));
/** "Keep history" (Settings): off means nothing new is saved */
export const histPrefs = reactive({ keep: readJson<boolean>("calcKeepHistory", true) });
const save = () => writeJson("calcHistory", history);

/** A sum short enough to keep on the device: 200 sums of 100,000 digits would fill its storage */
const keepable = (s: string) => s.length <= 2000;

export function addHistory(e: string, r: string, x: string, p?: HistProg, mode?: string) {
  if (!histPrefs.keep) return;
  const h = history[0];
  // the same sum again only moves up
  if (h && h.e === e && h.r === r && h.b === p?.base && h.w === p?.wordSize && h.s === p?.signed) return;
  if (!keepable(e)) return; // a sum too long to keep isn't listed
  // an answer too long to keep in full is kept to 30 digits, marked approximate
  history.unshift({ e, r, x: storable(x), t: Date.now(), ...(mode ? { m: mode } : {}), ...(p ? { b: p.base, w: p.wordSize, s: p.signed } : {}) });
  history.splice(0, history.length, ...capHistory(history));
  save();
}
/** Clears the list; with keepPinned the pinned entries stay */
export function clearHistory(keepPinned = false) { history.splice(0, history.length, ...(keepPinned ? history.filter((h) => h.p) : [])); save(); }
/** Puts back a list that was cleared (Undo) */
export function restoreHistory(items: HistItem[]) { history.splice(0, history.length, ...capHistory(items)); save(); }
export function togglePin(h: HistItem) { if (h.p) delete h.p; else h.p = true; save(); }
export function removeEntry(h: HistItem) { const i = history.indexOf(h); if (i >= 0) { history.splice(i, 1); save(); } }
export function setKeepHistory(on: boolean, deleteExisting = false) {
  histPrefs.keep = on; writeJson("calcKeepHistory", on);
  if (!on && deleteExisting) clearHistory();
}

// --- search, order and export (pure, tested in test/history.test.ts) ---
/** Entries whose expression or answer contains the text, case-insensitive; the minus sign and "-" match each other */
export function filterHistory(items: HistItem[], q: string): HistItem[] {
  const n = (s: string) => s.toLowerCase().replace(/−/g, "-");
  const t = n(q.trim());
  return t ? items.filter((h) => n(h.e).includes(t) || n(h.r).includes(t)) : items;
}
/** Pinned entries first, each group keeping its newest-first order */
export function splitPinned(items: HistItem[]): { pinned: HistItem[]; rest: HistItem[] } {
  return { pinned: items.filter((h) => h.p), rest: items.filter((h) => !h.p) };
}
/** The mode of an entry: stored, or programming when it carries a base */
export const modeOf = (h: HistItem) => h.m ?? (h.b ? "programming" : "");
const BASE_NAMES: Record<number, string> = { 2: "BIN", 8: "OCT", 10: "DEC", 16: "HEX" };
/** The extra info of a programming-mode entry, e.g. "HEX, 32-bit, signed" */
export function progInfo(h: HistItem): string {
  if (!h.b) return "";
  return [BASE_NAMES[h.b] ?? "base " + h.b, h.w ? h.w + "-bit" : "", h.s == null ? "" : h.s ? "signed" : "unsigned"].filter(Boolean).join(", ");
}
/** One line: "expression = answer" (with the base info after it for a programming entry) */
export const lineOf = (h: HistItem) => `${h.e} = ${h.r}` + (h.b ? ` [${progInfo(h)}]` : "");
export const toText = (items: HistItem[]) => items.map(lineOf).join("\n");
// Plain numbers (e.g. "-5", "+3", "-0.25", "1e-7") are not formulas, so they skip the guard.
const PLAIN_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
/** One CSV cell: quoted when it holds a comma, quote or line break; a cell that starts with = + - @ (or a tab or CR) gets an
 *  apostrophe first so a spreadsheet doesn't run it as a formula */
export function csvCell(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) && !PLAIN_NUMBER.test(v) ? "'" + v : v;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const CSV_HEAD = ["date_time", "mode", "base", "word_size", "signed", "expression", "result"];
export function toCsv(items: HistItem[]): string {
  const rows = items.map((h) => [
    h.t ? new Date(h.t).toISOString() : "", modeOf(h), h.b ? String(h.b) : "", h.w ? String(h.w) : "", h.s == null ? "" : h.s ? "yes" : "no", h.e, h.r,
  ].map(csvCell).join(","));
  return [CSV_HEAD.join(","), ...rows].join("\r\n") + "\r\n";
}
