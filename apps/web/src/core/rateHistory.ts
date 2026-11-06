// The rate graph's data: the daily history of the currencies of the pair shown, from the same official sources as the
// rates (the ECB Data Portal, the Central Bank of Argentina), asked for only while the Currency category is open (the
// graph is only there) and "Update currency rates online" is on, with the same rules as the rates (rates.ts): no
// cookies, no referrer, no identifiers, a background check at most every 4 hours per currency and a back-off after
// failures. What arrives is kept on this device (a year at most, a few currencies at most), so the graph shows offline
// too. Nothing waits for it: the converter works the same with or without a graph. Loaded only with the graph.
import { reactive } from "vue";
import {
  ecbHistoryUrl, bcraHistoryUrl, parseEcbHistoryCsv, parseBcraHistoryJson, mergeDays, periodStart, retryDelayMs, AUTO_EVERY_MS, type DayRates,
} from "@calc/core";
import { readJson, writeJson } from "./prefs";
import { rates } from "./rates";

interface Held {
  days: DayRates;
  /** the earliest day asked for: older days than this were never asked, so a longer period asks again */
  from: string;
  /** when it was last asked (ms) */
  checkedAt: number;
  /** when the graph last showed it (ms): the least recently shown goes first when there are too many */
  usedAt: number;
}
const KEY = "rateHistory", MAX_CODES = 8;
const isHeld = (h: unknown): h is Held => {
  const x = h as Held | null;
  return !!x && typeof x.days === "object" && !!x.days && typeof x.from === "string" && typeof x.checkedAt === "number" && typeof x.usedAt === "number" &&
    Object.entries(x.days).every(([d, v]) => /^\d{4}-\d\d-\d\d$/.test(d) && typeof v === "string" && /^\d+(\.\d+)?$/.test(v));
};
const saved = readJson<Record<string, unknown>>(KEY, {});
const start: Record<string, Held> = {};
if (saved && typeof saved === "object") for (const [c, h] of Object.entries(saved)) if (/^[A-Z]{3}$/.test(c) && isHeld(h)) start[c] = h;

export const history = reactive({
  held: start,
  loading: false,
  /** the last attempt failed (the graph says so only when it has nothing to show) */
  failed: false,
  failures: 0,
  failedAt: 0,
});

const today = () => new Date().toISOString().slice(0, 10);

/** keeps the most recently shown currencies only, then saves */
function save() {
  const keep = Object.entries(history.held).sort(([, a], [, b]) => b.usedAt - a.usedAt).slice(0, MAX_CODES);
  if (keep.length < Object.keys(history.held).length) history.held = Object.fromEntries(keep);
  writeJson(KEY, history.held);
}

async function ask<T>(url: string, parse: (t: string) => T, signal: AbortSignal): Promise<T | null> {
  try {
    // as the rates: nothing that could tell who is asking
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal });
    return res.ok ? parse(await res.text()) : null;
  } catch { return null; }
}

/** Makes sure the days of these currencies (ECB codes, or "ARS" from the BCRA) from `from` on are held, asking only
 *  when it is allowed and due. Never throws, never blocks anything. */
export async function ensureHistory(codes: string[], from: string): Promise<void> {
  const now = Date.now();
  for (const c of codes) if (history.held[c]) history.held[c]!.usedAt = now;
  if (!rates.online || history.loading || navigator.onLine === false) return;
  if (history.failures > 0 && now - history.failedAt < retryDelayMs(history.failures)) return;
  const due = codes.filter((c) => { const h = history.held[c]; return !h || h.from > from || now - h.checkedAt >= AUTO_EVERY_MS; });
  if (!due.length) return;
  history.loading = true;
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 20_000);
  try {
    const ecb = due.filter((c) => c !== "ARS"), end = today();
    const [e, a] = await Promise.all([
      ecb.length ? ask(ecbHistoryUrl(ecb, from), parseEcbHistoryCsv, stop.signal) : Promise.resolve(null),
      due.includes("ARS") ? ask(bcraHistoryUrl(from, end), parseBcraHistoryJson, stop.signal) : Promise.resolve(null),
    ]);
    const got: Record<string, DayRates> = { ...(e ?? {}), ...(a ? { ARS: a } : {}) };
    const keepFrom = periodStart(end, "1Y");
    let ok = true;
    for (const c of due) {
      const answered = c === "ARS" ? !!a : !!e;
      if (!answered) { ok = false; continue; }
      const h = history.held[c];
      // an answer without this currency still counts as asked (the ECB has nothing for it in that period)
      history.held[c] = { days: mergeDays(h?.days, got[c] ?? {}, keepFrom), from: h && h.from < from ? h.from : from < keepFrom ? keepFrom : from, checkedAt: now, usedAt: now };
    }
    save();
    if (ok) { history.failures = 0; history.failed = false; } else { history.failures++; history.failedAt = Date.now(); history.failed = true; }
  } finally {
    clearTimeout(timer); history.loading = false;
  }
}

/** the days held per currency, for pairSeries */
export const heldDays = (): Record<string, DayRates> => Object.fromEntries(Object.entries(history.held).map(([c, h]) => [c, h.days]));
