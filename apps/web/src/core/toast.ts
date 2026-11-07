// Short messages at the bottom ("Copied", "Saved"). Only results, never chatter.
import { reactive } from "vue";
import { t } from "./i18n";

export interface Toast { id: number; text: string; kind: "ok" | "err" | "pr"; action?: { label: string; run: () => void } }
export const toasts = reactive<Toast[]>([]);
let n = 0;
export function toast(text: string, o: { kind?: Toast["kind"]; action?: Toast["action"]; ms?: number } = {}) {
  const t: Toast = { id: ++n, text, kind: o.kind ?? "ok", action: o.action };
  toasts.push(t);
  if (toasts.length > 3) toasts.shift();
  setTimeout(() => { const i = toasts.findIndex((x) => x.id === t.id); if (i >= 0) toasts.splice(i, 1); }, o.ms ?? (o.action ? 6000 : 3200));
}
/** Copies text and says so ("Copied", or `msg`), or says it couldn't where there is no clipboard; nothing to copy does nothing.
 *  One helper so every Copy button behaves the same. */
export async function copyToClipboard(s: string, msg?: string) {
  if (!s) return;
  try { await navigator.clipboard.writeText(s); toast(msg ?? t("c.copied")); } catch { toast(t("c.couldntCopy"), { kind: "err" }); }
}
