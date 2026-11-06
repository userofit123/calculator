// Past calculations, newest first, kept only on this device (at most 200). Small and in the main bundle because the
// calculator writes to it on every =; the History page that lists it loads lazily.
import { reactive } from "vue";
import { storable } from "@calc/core";
import { readJson, writeJson } from "./prefs";

/** e: the expression as typed, r: the answer as shown then (decimal "."), x: the answer in full (for reuse) */
interface HistItem { e: string; r: string; x: string; t: number }
const MAX = 200;

export const history = reactive<HistItem[]>(readJson<HistItem[]>("calcHistory", []).slice(0, MAX));
const save = () => writeJson("calcHistory", history);

/** A sum short enough to keep on the device: 200 sums of 100,000 digits would fill its storage */
const keepable = (s: string) => s.length <= 2000;

export function addHistory(e: string, r: string, x: string) {
  // the same sum again only moves up
  if (history[0]?.e === e && history[0].r === r) return;
  if (!keepable(e)) return; // a sum too long to keep isn't listed
  // an answer too long to keep in full is kept to 30 digits, marked approximate
  history.unshift({ e, r, x: storable(x), t: Date.now() });
  if (history.length > MAX) history.length = MAX;
  save();
}
export function clearHistory() { history.splice(0); save(); }
/** Puts back a list that was cleared (Undo) */
export function restoreHistory(items: HistItem[]) { history.splice(0, history.length, ...items.slice(0, MAX)); save(); }
