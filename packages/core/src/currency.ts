// Currencies from official data only: the European Central Bank's euro reference rates (1 EUR = rate units of a
// currency), read from the ECB Data Portal's CSV, and converted through the euro (USD → JPY = USD → EUR → JPY), exactly
// with the published decimals. For currencies the ECB doesn't quote, only the country's own central bank counts: its
// official euro rate where it publishes one a web page may read (central-banks.ts), or the parity it fixes by law
// (CFA franc to the euro, Gulf currencies to the US dollar). Anything else is left out, never filled in from a
// third-party rates service. docs/currency-sources.md lists every source and why the others are missing.
import type { Category, Unit } from "./units";

export interface RateSet {
  /** the day the rates are for (YYYY-MM-DD) */
  date: string;
  /** currency code → units per euro, as published ("1.1224") */
  rates: Record<string, string>;
  /** the day of each currency's own rate when it isn't `date` (the ECB's newest day can lack some currencies); missing = `date` */
  dates?: Record<string, string>;
  /** where each currency's rate came from when it isn't the ECB (a RATE_SOURCES id: "nbu", "bcra"); missing = "ecb" */
  sources?: Record<string, string>;
}

/** A rate older than this many days before the newest day is dropped: the ECB's series of currencies it stopped quoting
 *  (RUB, ARS, ...) still answer with their last, years-old rate */
export const MAX_RATE_AGE_DAYS = 30;
const dayNum = (d: string) => Date.parse(d + "T12:00:00Z") / 86_400_000;
const validDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d\d-\d\d$/.test(d);
/** the day of one currency's rate */
export const rateDayOf = (rs: RateSet, code: string) => rs.dates?.[code] ?? rs.date;
/** the source id of one currency's rate ("ecb" unless a central bank's own) */
export const rateSourceOf = (rs: RateSet, code: string) => rs.sources?.[code] ?? "ecb";
/** the newest day of one source's rates ("" when the set has none from it) */
export const sourceDayOf = (rs: RateSet, src: string) =>
  Object.keys(rs.rates).filter((c) => rateSourceOf(rs, c) === src).map((c) => rateDayOf(rs, c)).reduce((m, d) => (d > m ? d : m), "");

/** Combines a new answer with the rates already held: per currency the newest row wins (a currency the new answer lacks
 *  keeps its saved rate and its own date), then rates too old next to the newest day are dropped. */
export function mergeRates(prev: RateSet | null | undefined, next: RateSet): RateSet {
  // each row keeps the source it came from, so a central bank's rate is always shown as that bank's
  const rows: Record<string, [string, string, string]> = {};
  for (const rs of prev ? [prev, next] : [next]) {
    for (const [c, v] of Object.entries(rs.rates)) {
      const d = rateDayOf(rs, c);
      if (!validDay(d)) continue;
      if (!rows[c] || d >= rows[c]![0]) rows[c] = [d, v, rateSourceOf(rs, c)];
    }
  }
  const date = Object.values(rows).reduce((m, [d]) => (d > m ? d : m), "");
  const rates: Record<string, string> = {}, dates: Record<string, string> = {}, sources: Record<string, string> = {};
  for (const [c, [d, v, src]] of Object.entries(rows).sort(([a], [b]) => a.localeCompare(b))) {
    if (dayNum(date) - dayNum(d) > MAX_RATE_AGE_DAYS) continue;
    rates[c] = v;
    if (d !== date) dates[c] = d;
    if (src !== "ecb") sources[c] = src;
  }
  return { date, rates, ...(Object.keys(dates).length ? { dates } : {}), ...(Object.keys(sources).length ? { sources } : {}) };
}

/** Back-off after failed downloads: no sooner than 30 minutes, doubling per further failure, never beyond 4 hours */
export const RETRY_MIN_MS = 30 * 60_000;
export const AUTO_EVERY_MS = 4 * 3600_000;
export const retryDelayMs = (failures: number) => (failures <= 0 ? 0 : Math.min(AUTO_EVERY_MS, RETRY_MIN_MS * 2 ** (failures - 1)));
/** Whether the background refresh may ask the ECB now (the "Refresh now" button ignores this) */
export function refreshDue(now: number, checkedAt: number, failedAt: number, failures: number): boolean {
  return now - checkedAt >= AUTO_EVERY_MS && (failures <= 0 || now - failedAt >= retryDelayMs(failures));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "3 Nov 2026" from YYYY-MM-DD */
export const shortDay = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? ""} ${d.slice(0, 4)}`;

/** Where the app asks for the rates: the ECB Data Portal's daily reference rates, the latest day of every currency
 *  (the ECB's eurofxref files can't be read by a web page: they don't allow other sites) */
export const ECB_RATES_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=csvdata&detail=dataonly";
export const ECB_SOURCE = "European Central Bank reference rates";

/** Currencies whose rate to the euro is fixed (official parities, not market rates): the lev's for good when Bulgaria
 *  joined the euro; the two CFA francs' by the agreements their central banks (BCEAO, BEAC) work under */
export const FIXED_EURO_RATES: Record<string, string> = { BGN: "1.95583", XOF: "655.957", XAF: "655.957" };
/** who fixes each of those parities (none shown for the lev: its rate was fixed for good) */
export const FIXED_EURO_BY: Record<string, string> = { XOF: "BCEAO", XAF: "BEAC" };
/** Currencies their central bank pegs to the US dollar at an official, published rate (units per US dollar): their euro
 *  rate is the peg times the ECB's dollar rate, so it is as official as both. (The Hong Kong dollar's peg is a band,
 *  and the ECB quotes it anyway.) */
export const USD_PEGS: Record<string, { rate: string; by: string }> = {
  AED: { rate: "3.6725", by: "Central Bank of the UAE" },
  SAR: { rate: "3.75", by: "Saudi Central Bank" },
  QAR: { rate: "3.64", by: "Qatar Central Bank" },
  BHD: { rate: "0.376", by: "Central Bank of Bahrain" },
  OMR: { rate: "0.3845", by: "Central Bank of Oman" },
  JOD: { rate: "0.709", by: "Central Bank of Jordan" },
};
// Only the lev is kept: Bulgaria joined the euro on 2026-01-01, so levs are still in wallets and prices are still being
// converted. The kuna (2023) and kroon (2011) are long gone, nobody converts them any more, and the ECB no longer quotes
// them: dropped (a saved choice of one shows "No rate for ..." instead of silently switching).

export const CURRENCY_NAMES: Record<string, string> = {
  EUR: "Euro", USD: "US dollar", JPY: "Japanese yen", GBP: "British pound", CHF: "Swiss franc", AUD: "Australian dollar",
  BRL: "Brazilian real", CAD: "Canadian dollar", CNY: "Chinese yuan", CZK: "Czech koruna", DKK: "Danish krone",
  HKD: "Hong Kong dollar", HUF: "Hungarian forint", IDR: "Indonesian rupiah", ILS: "Israeli new shekel",
  INR: "Indian rupee", ISK: "Icelandic krona", KRW: "South Korean won", MXN: "Mexican peso", MYR: "Malaysian ringgit",
  NOK: "Norwegian krone", NZD: "New Zealand dollar", PHP: "Philippine peso", PLN: "Polish zloty", RON: "Romanian leu",
  SEK: "Swedish krona", SGD: "Singapore dollar", THB: "Thai baht", TRY: "Turkish lira", ZAR: "South African rand",
  BGN: "Bulgarian lev", RUB: "Russian ruble",
  UAH: "Ukrainian hryvnia", ARS: "Argentine peso", AED: "UAE dirham", SAR: "Saudi riyal", QAR: "Qatari riyal",
  BHD: "Bahraini dinar", OMR: "Omani rial", JOD: "Jordanian dinar", XOF: "West African CFA franc", XAF: "Central African CFA franc",
};

/** The live sources: the ECB, and central banks whose own euro rate for their own currency a web page may read */
export const RATE_SOURCES: Record<string, { name: string; short: string }> = {
  ecb: { name: ECB_SOURCE, short: "ECB" },
  nbu: { name: "National Bank of Ukraine", short: "National Bank of Ukraine" },
  bcra: { name: "Central Bank of Argentina", short: "Central Bank of Argentina" },
};

/** Where one currency's rate comes from and for which day, in words: "National Bank of Ukraine, 6 Nov 2026",
 *  "Fixed at 3.6725 per US dollar (Central Bank of the UAE)"; "" for the euro or a currency with no rate */
export function rateSourceLine(rs: RateSet, code: string): string {
  if (code === "EUR") return "";
  if (rs.rates[code]) return `${RATE_SOURCES[rateSourceOf(rs, code)]?.name ?? rateSourceOf(rs, code)}, ${shortDay(rateDayOf(rs, code))}`;
  const fixed = FIXED_EURO_RATES[code];
  if (fixed) return `Fixed at ${fixed} per euro${FIXED_EURO_BY[code] ? ` (${FIXED_EURO_BY[code]})` : ""}`;
  const peg = USD_PEGS[code];
  if (peg && rs.rates.USD) return `Fixed at ${peg.rate} per US dollar (${peg.by}) · ECB dollar rate of ${shortDay(rateDayOf(rs, "USD"))}`;
  return "";
}

/** The country flag as an emoji (two regional-indicator letters from the code; EU for the euro), no images */
export const currencyFlag = (code: string) =>
  /^[A-Z]{3}$/.test(code) ? String.fromCodePoint(...[...code.slice(0, 2)].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

/** Reads the ECB Data Portal's CSV: per currency its newest row (the newest day can lack some currencies), each with its
 *  own date; rows far older than the newest day (RUB, ...) are dropped. */
export function parseEcbCsv(text: string): RateSet {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(","));
  const head = lines.shift() ?? [];
  const [C, D, V] = ["CURRENCY", "TIME_PERIOD", "OBS_VALUE"].map((n) => head.indexOf(n));
  if (C! < 0 || D! < 0 || V! < 0) throw new Error("Not the ECB's rate data");
  const rates: Record<string, string> = {}, dates: Record<string, string> = {};
  for (const r of lines) {
    const c = r[C!] ?? "", v = r[V!] ?? "", d = r[D!] ?? "";
    if (validDay(d) && /^[A-Z]{3}$/.test(c) && /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 && d >= (dates[c] ?? "")) { rates[c] = v; dates[c] = d; }
  }
  const date = Object.values(dates).reduce((m, d) => (d > m ? d : m), "");
  if (!date || Object.keys(rates).length < 10) throw new Error("The ECB's rate data looks incomplete");
  return mergeRates(null, { date, rates, dates });
}

/** The currency "category": every unit is a currency, its factor the euros one unit is worth (1 ÷ rate) */
export function currencyCategory(rs: RateSet): Category {
  const list: Unit[] = [{ id: "EUR", name: CURRENCY_NAMES.EUR!, symbol: "EUR", factor: "1" }];
  for (const [code, rate] of Object.entries(rs.rates).sort(([a], [b]) => (CURRENCY_NAMES[a] ?? a).localeCompare(CURRENCY_NAMES[b] ?? b))) {
    if (code === "EUR" || !/^\d+(\.\d+)?$/.test(rate)) continue;
    const own = rs.dates?.[code], src = rateSourceOf(rs, code);
    // a central bank's rate always names the bank and its day; an ECB rate only its day when it isn't the ECB's newest
    const hint = src !== "ecb" ? rateSourceLine(rs, code) : own && own !== sourceDayOf(rs, "ecb") ? `Rate of ${shortDay(own)}` : "";
    list.push({ id: code, name: CURRENCY_NAMES[code] ?? code, symbol: code, factor: `1/${rate}`, ...(hint ? { hint } : {}) });
  }
  const extra: Unit[] = [];
  for (const [code, rate] of Object.entries(FIXED_EURO_RATES)) {
    if (!rs.rates[code]) extra.push({ id: code, name: CURRENCY_NAMES[code] ?? code, symbol: code, factor: `1/${rate}`, hint: rateSourceLine(rs, code) });
  }
  // pegged to the dollar: units per euro = peg × the ECB's dollar rate, worked out exactly by the engine
  const usd = rs.rates.USD;
  if (usd && /^\d+(\.\d+)?$/.test(usd)) {
    for (const [code, peg] of Object.entries(USD_PEGS)) {
      if (!rs.rates[code]) extra.push({ id: code, name: CURRENCY_NAMES[code] ?? code, symbol: code, factor: `1/(${peg.rate}*${usd})`, hint: rateSourceLine(rs, code) });
    }
  }
  const all = [list[0]!, ...[...list.slice(1), ...extra].sort((a, b) => a.name.localeCompare(b.name))];
  return { id: "currency", name: "Currency", base: "EUR", units: all };
}
