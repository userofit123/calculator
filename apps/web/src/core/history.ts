// Past calculations, newest first, kept only on this device (at most 200). Small and in the main bundle because the
// calculator writes to it on every =; the History page that lists it loads lazily.
import { reactive } from "vue";
import { storable } from "@calc/core";
import { readJson, writeJson } from "./prefs";

/** e: the expression as typed, r: the answer as shown then (decimal "."), x: the answer in full (for reuse),
 *  b, w, s: the base, word size and signed setting of a programming-mode sum (its digits mean nothing without the base,
 *  and FF + 1 or NOT 0 give another answer in another word size or sign; x is decimal) */
export interface HistItem { e: string; r: string; x: string; t: number; b?: number; w?: number; s?: boolean }
/** A programming-mode sum's settings */
export interface HistProg { base: number; wordSize: number; signed: boolean }
const MAX = 200;

export const history = reactive<HistItem[]>(readJson<HistItem[]>("calcHistory", []).slice(0, MAX));
const save = () => writeJson("calcHistory", history);

/** A sum short enough to keep on the device: 200 sums of 100,000 digits would fill its storage */
const keepable = (s: string) => s.length <= 2000;

export function addHistory(e: string, r: string, x: string, p?: HistProg) {
  const h = history[0];
  // the same sum again only moves up
  if (h && h.e === e && h.r === r && h.b === p?.base && h.w === p?.wordSize && h.s === p?.signed) return;
  if (!keepable(e)) return; // a sum too long to keep isn't listed
  // an answer too long to keep in full is kept to 30 digits, marked approximate
  history.unshift({ e, r, x: storable(x), t: Date.now(), ...(p ? { b: p.base, w: p.wordSize, s: p.signed } : {}) });
  if (history.length > MAX) history.length = MAX;
  save();
}
export function clearHistory() { history.splice(0); save(); }
/** Puts back a list that was cleared (Undo) */
export function restoreHistory(items: HistItem[]) { history.splice(0, history.length, ...items.slice(0, MAX)); save(); }
