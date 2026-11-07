// The converter's rate graph: the daily history of one currency pair, from the same official sources as the rates
// (the ECB Data Portal's daily reference rates, the Central Bank of Argentina's own euro quotes) and the same fixed
// parities. Every source gives units per euro, so a pair's rate on a day is rateTo ÷ rateFrom of that day, and only days
// both sides have are drawn (weekends, holidays and a bank's missing days are simply not there). The National Bank of
// Ukraine's history can only be read one day per request (its range answer doesn't allow other sites), so the hryvnia
// has no graph. These numbers are only drawn and summed up to a few digits, so plain floating point is fine here.
import { FIXED_EURO_RATES, USD_PEGS, isDay, ecbCsvRows } from "./currency";

/** one source's history of one currency: day (YYYY-MM-DD) → units per euro, as published */
export type DayRates = Record<string, string>;
export interface RatePoint { day: string; value: number }
export type GraphPeriod = "1M" | "3M" | "1Y";
export const GRAPH_PERIODS: GraphPeriod[] = ["1M", "3M", "1Y"];

const okRate = (v: string) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0;

/** The first day of a period ending today (UTC): one month, three months or a year back */
export function periodStart(today: string, p: GraphPeriod): string {
  const [y, m, d] = today.split("-").map(Number), months = p === "1M" ? 1 : p === "3M" ? 3 : 12;
  const t = new Date(Date.UTC(y!, m! - 1 - months, 1));
  // the same day of the month, or the month's last when it is shorter (31 Mar - 1 month = 28/29 Feb)
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d!, last));
  return t.toISOString().slice(0, 10);
}

/** Where a currency's history comes from: "ecb" (with the ECB's code to ask for), "bcra", nothing to ask (the euro and
 *  the euro's fixed parities), or null when the app can't draw it */
export function historySource(code: string): { src: "ecb" | "bcra"; code: string } | { src: "fixed" } | null {
  if (code === "EUR" || FIXED_EURO_RATES[code]) return { src: "fixed" };
  if (USD_PEGS[code]) return { src: "ecb", code: "USD" };
  if (code === "ARS") return { src: "bcra", code: "ARS" };
  if (code === "UAH" || !/^[A-Z]{3}$/.test(code)) return null;
  return { src: "ecb", code };
}

/** The ECB Data Portal's daily reference rates of a few currencies from a day on (the currencies of one pair) */
export const ecbHistoryUrl = (codes: string[], start: string) =>
  `https://data-api.ecb.europa.eu/service/data/EXR/D.${codes.join("+")}.EUR.SP00.A?startPeriod=${start}&format=csvdata&detail=dataonly`;
/** The BCRA's euro quotes (ARS per euro) between two days */
export const bcraHistoryUrl = (start: string, end: string) =>
  `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/EUR?fechadesde=${start}&fechahasta=${end}`;

/** Reads the ECB's CSV of several days: per currency its days. A row without a value (a day the ECB didn't fix that
 *  currency), with a bad day or a bad number is left out; an answer that isn't the ECB's throws. */
export function parseEcbHistoryCsv(text: string): Record<string, DayRates> {
  const out: Record<string, DayRates> = {};
  for (const r of ecbCsvRows(text)) {
    const [c, d, v] = r.map((x) => x.trim()) as [string, string, string];
    if (/^[A-Z]{3}$/.test(c) && isDay(d) && okRate(v)) (out[c] ??= {})[d] = v;
  }
  return out;
}

/** Reads the BCRA's answer of several days: ARS per euro by day. Anything unexpected throws; a bad row is left out. */
export function parseBcraHistoryJson(text: string): DayRates {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("Not the BCRA's rate data"); }
  const res = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(res)) throw new Error("Not the BCRA's rate data");
  const out: DayRates = {};
  for (const row of res) {
    const r = row as { fecha?: unknown; detalle?: unknown } | null;
    if (!r || typeof r.fecha !== "string" || !isDay(r.fecha) || !Array.isArray(r.detalle)) continue;
    const eur = r.detalle.find((x) => (x as { codigoMoneda?: unknown } | null)?.codigoMoneda === "EUR") as { tipoCotizacion?: unknown } | undefined;
    const n = eur?.tipoCotizacion;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) out[r.fecha] = String(n);
  }
  return out;
}

/** units per euro of one currency, day by day: a fixed parity is a number for every day, a dollar peg follows the ECB's
 *  dollar; null when the history isn't there */
function perEuro(code: string, held: Record<string, DayRates>): number | ((day: string) => number | null) | null {
  if (code === "EUR") return 1;
  if (FIXED_EURO_RATES[code]) return Number(FIXED_EURO_RATES[code]);
  const s = historySource(code);
  if (!s || s.src === "fixed") return null;
  const days = held[s.code];
  if (!days) return null;
  const peg = USD_PEGS[code] ? Number(USD_PEGS[code]!.rate) : 1;
  return (d) => (days[d] && okRate(days[d]!) ? Number(days[d]) * peg : null);
}

/** Whether a pair's rate never moves (both sides the euro or fixed to it): no graph, a note instead */
export const fixedPair = (from: string, to: string) => historySource(from)?.src === "fixed" && historySource(to)?.src === "fixed";

/** A pair's daily history from `start` on: units of `to` for one `from`, on the days both sides have a rate */
export function pairSeries(from: string, to: string, held: Record<string, DayRates>, start = ""): RatePoint[] {
  const a = perEuro(from, held), b = perEuro(to, held);
  if (a === null || b === null || (typeof a === "number" && typeof b === "number")) return [];
  const days = new Set<string>();
  for (const code of [from, to]) {
    const s = historySource(code);
    if (s && s.src !== "fixed") for (const d of Object.keys(held[s.code] ?? {})) if (d >= start) days.add(d);
  }
  const out: RatePoint[] = [];
  for (const day of [...days].sort()) {
    const x = typeof a === "number" ? a : a(day), y = typeof b === "number" ? b : b(day);
    if (x && y) out.push({ day, value: y / x });
  }
  return out;
}

/** a rate to `sig` significant digits as a plain decimal ("1.0842", "157.23", "0.0061234"), never "1e-7" */
export function rateText(n: number, sig = 5): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const mag = Math.floor(Math.log10(Math.abs(n))), dp = Math.max(0, Math.min(12, sig - 1 - mag));
  return n.toFixed(dp).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export interface SeriesStats { first: RatePoint; last: RatePoint; min: RatePoint; max: RatePoint; /** change from first to last, % to 2 decimals ("3.41", "-0.5") */ change: string }
/** The first and last day, the lowest and the highest, and the change over the period */
export function seriesStats(s: RatePoint[]): SeriesStats | null {
  if (!s.length) return null;
  let min = s[0]!, max = s[0]!;
  for (const p of s) { if (p.value < min.value) min = p; if (p.value > max.value) max = p; }
  const first = s[0]!, last = s[s.length - 1]!, pct = ((last.value - first.value) / first.value) * 100;
  const change = (Math.round(pct * 100) / 100).toFixed(2).replace(/\.?0+$/, "").replace(/^-0$/, "0");
  return { first, last, min, max, change };
}

/** Merges a new answer into the days held, keeping only days from `keepFrom` on (the cache stays a year at most) */
export function mergeDays(held: DayRates | undefined, add: DayRates, keepFrom: string): DayRates {
  const out: DayRates = {};
  for (const [d, v] of Object.entries({ ...held, ...add }).sort(([x], [y]) => x.localeCompare(y))) if (d >= keepFrom && isDay(d) && okRate(v)) out[d] = v;
  return out;
}

/** The graph's value axis: a little room above and below the line, and `n` evenly spaced labels written to as many
 *  decimals as their step needs ("1.115", "1.12", ...) */
export function graphScale(values: number[], n = 4): { lo: number; hi: number; ticks: { value: number; text: string }[] } {
  if (!values.length) return { lo: 0, hi: 1, ticks: [] };
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.01 || 1;
  lo -= pad; hi += pad;
  if (Math.min(...values) >= 0 && lo < 0) lo = 0;
  const step = (hi - lo) / (n - 1), dp = Math.max(0, Math.min(10, Math.ceil(-Math.log10(step)) + 1));
  const ticks = Array.from({ length: n }, (_, i) => { const value = lo + step * i; return { value, text: value.toFixed(dp) }; });
  return { lo, hi, ticks };
}
