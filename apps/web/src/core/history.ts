// Past calculations, newest first, kept only on this device (at most 200). Small and in the main bundle because the
// calculator writes to it on every =; the History page that lists it loads lazily.
import { reactive } from "vue";
import { readJson, writeJson } from "./prefs";

/** e: the expression as typed, r: the answer as shown then (decimal "."), x: the answer in full (for reuse) */
export interface HistItem { e: string; r: string; x: string; t: number }
const MAX = 200;

export const history = reactive<HistItem[]>(readJson<HistItem[]>("calcHistory", []).slice(0, MAX));
const save = () => writeJson("calcHistory", history);

export function addHistory(e: string, r: string, x: string) {
  // the same sum again only moves up
  if (history[0]?.e === e && history[0].r === r) return;
  history.unshift({ e, r, x, t: Date.now() });
  if (history.length > MAX) history.length = MAX;
  save();
}
export function clearHistory() { history.splice(0); save(); }
/** Puts back a list that was cleared (Undo) */
export function restoreHistory(items: HistItem[]) { history.splice(0, history.length, ...items.slice(0, MAX)); save(); }
