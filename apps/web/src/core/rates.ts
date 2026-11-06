// Currency rates: the ECB's euro reference rates. The rates of the day the app was built ship inside it, the last
// downloaded ones are kept on this device, and the converter always works from whichever is newer, with no internet
// too. Downloading is the app's only network request: straight from the ECB (no third party), no cookies, no referrer,
// no identifiers, and only while "Update currency rates online" is on. It never holds anything up: the converter shows
// the rates it has and swaps in newer ones when they arrive. Loaded only with the Converter and Settings pages.
import { reactive, watch } from "vue";
import { BUNDLED_RATES, ECB_RATES_URL, parseEcbCsv, mergeRates, refreshDue, type RateSet } from "@calc/core";
import { readJson, writeJson } from "./prefs";

interface Kept extends RateSet { /** when it was downloaded (ms), 0 for the rates that ship with the app */ fetchedAt: number }
const okSet = (s: unknown): s is Kept => {
  const k = s as Kept | null;
  return !!k && typeof k.date === "string" && /^\d{4}-\d\d-\d\d$/.test(k.date) && !!k.rates && typeof k.rates === "object" &&
    Object.values(k.rates).every((v) => typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) &&
    (k.dates === undefined || (typeof k.dates === "object" && Object.values(k.dates).every((d) => typeof d === "string" && /^\d{4}-\d\d-\d\d$/.test(d))));
};
const saved = readJson<unknown>("ecbRates", null);
const bundled: Kept = { ...BUNDLED_RATES, fetchedAt: 0 };

export const rates = reactive({
  /** the rates in use: the downloaded ones when they are newer than the ones that ship with the app */
  set: (okSet(saved) ? { ...mergeRates(bundled, saved), fetchedAt: saved.fetchedAt } : bundled) as Kept,
  /** "Update currency rates online" (Settings) */
  online: readJson<boolean>("ratesOnline", true) !== false,
  loading: false,
  /** the last attempt's outcome, "" when it worked or none was made */
  error: "",
  /** when the ECB was last asked (ms), to ask at most a few times a day on its own */
  checkedAt: readJson<number>("ratesCheckedAt", 0),
  /** failed attempts in a row and when the last one was: the background refresh backs off (30 min, doubling, 4 h at most) */
  failures: readJson<number>("ratesFailures", 0),
  failedAt: readJson<number>("ratesFailedAt", 0),
});
watch(() => rates.online, (v) => { writeJson("ratesOnline", v); if (v) autoRefresh(); });

/** "5 Nov 2026" */
export const rateDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Asks the ECB for the latest rates (only with the setting on). Resolves when done; never throws. */
export async function refreshRates(): Promise<void> {
  if (!rates.online || rates.loading) return;
  rates.loading = true; rates.error = "";
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 20_000);
  try {
    // nothing that could tell who is asking: no cookies, no referrer, no extra headers
    const res = await fetch(ECB_RATES_URL, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: stop.signal });
    if (!res.ok) throw new Error(`The ECB answered ${res.status}`);
    const got = parseEcbCsv(await res.text());
    rates.checkedAt = Date.now(); writeJson("ratesCheckedAt", rates.checkedAt);
    // per currency the newest row wins: a currency the ECB's newest day lacks keeps its saved rate and its own date
    rates.set = { ...mergeRates(rates.set, got), fetchedAt: Date.now() }; writeJson("ecbRates", rates.set);
    rates.failures = 0; writeJson("ratesFailures", 0);
  } catch {
    // an answer that isn't usable counts as a failure too; the rates already held stay untouched
    rates.failures++; rates.failedAt = Date.now(); writeJson("ratesFailures", rates.failures); writeJson("ratesFailedAt", rates.failedAt);
    rates.error = typeof navigator !== "undefined" && navigator.onLine === false ? "No internet connection" : "Couldn't reach the ECB";
  } finally {
    clearTimeout(timer); rates.loading = false;
  }
}

// The ECB publishes once a working day (around 16:00 CET), so on its own the app asks at most every 4 hours, and after a
// failure not before 30 minutes (then 1 h, 2 h, 4 h). It asks when the Currency category opens, when the device comes
// back online and when the setting is switched on; "Refresh now" always asks.
/** Refreshes in the background when the setting is on, there is a connection and it is due */
export function autoRefresh() {
  if (!rates.online || rates.loading || navigator.onLine === false || !refreshDue(Date.now(), rates.checkedAt, rates.failedAt, rates.failures)) return;
  void refreshRates();
}
addEventListener("online", autoRefresh);
