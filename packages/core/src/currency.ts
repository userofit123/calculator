// Currencies from official data only: the European Central Bank's euro reference rates (1 EUR = rate units of a
// currency), read from the ECB Data Portal's CSV, and converted through the euro (USD → JPY = USD → EUR → JPY), exactly
// with the published decimals. The ECB doesn't quote every currency GNOME's calculator lists; those are left out until an
// official central-bank source is added for them, never filled in from a third-party rates service.
import type { Category, Unit } from "./units";

export interface RateSet {
  /** the day the rates are for (YYYY-MM-DD) */
  date: string;
  /** currency code → units per euro, as published ("1.1224") */
  rates: Record<string, string>;
}

/** Where the app asks for the rates: the ECB Data Portal's daily reference rates, the latest day of every currency
 *  (the ECB's eurofxref files can't be read by a web page: they don't allow other sites) */
export const ECB_RATES_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=csvdata&detail=dataonly";
export const ECB_SOURCE = "European Central Bank reference rates";

/** Currencies whose rate to the euro was fixed for good when their country joined the euro (official, not market rates) */
export const FIXED_EURO_RATES: Record<string, string> = { BGN: "1.95583", HRK: "7.5345", EEK: "15.6466" };

export const CURRENCY_NAMES: Record<string, string> = {
  EUR: "Euro", USD: "US dollar", JPY: "Japanese yen", GBP: "British pound", CHF: "Swiss franc", AUD: "Australian dollar",
  BRL: "Brazilian real", CAD: "Canadian dollar", CNY: "Chinese yuan", CZK: "Czech koruna", DKK: "Danish krone",
  HKD: "Hong Kong dollar", HUF: "Hungarian forint", IDR: "Indonesian rupiah", ILS: "Israeli new shekel",
  INR: "Indian rupee", ISK: "Icelandic krona", KRW: "South Korean won", MXN: "Mexican peso", MYR: "Malaysian ringgit",
  NOK: "Norwegian krone", NZD: "New Zealand dollar", PHP: "Philippine peso", PLN: "Polish zloty", RON: "Romanian leu",
  SEK: "Swedish krona", SGD: "Singapore dollar", THB: "Thai baht", TRY: "Turkish lira", ZAR: "South African rand",
  BGN: "Bulgarian lev", HRK: "Croatian kuna", EEK: "Estonian kroon", RUB: "Russian ruble",
};

/** The country flag as an emoji (two regional-indicator letters from the code; EU for the euro), no images */
export const currencyFlag = (code: string) =>
  /^[A-Z]{3}$/.test(code) ? String.fromCodePoint(...[...code.slice(0, 2)].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

/** Reads the ECB Data Portal's CSV: the newest day's rates. Series of currencies the ECB no longer quotes (RUB, ARS, …)
 *  still answer with their last, years-old rate, so only rates of the newest day are kept. */
export function parseEcbCsv(text: string): RateSet {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(","));
  const head = lines.shift() ?? [];
  const [C, D, V] = ["CURRENCY", "TIME_PERIOD", "OBS_VALUE"].map((n) => head.indexOf(n));
  if (C! < 0 || D! < 0 || V! < 0) throw new Error("Not the ECB's rate data");
  let date = "";
  for (const r of lines) if ((r[D!] ?? "") > date) date = r[D!]!;
  const rates: Record<string, string> = {};
  for (const r of lines) {
    const c = r[C!] ?? "", v = r[V!] ?? "";
    if (r[D!] === date && /^[A-Z]{3}$/.test(c) && /^\d+(\.\d+)?$/.test(v) && Number(v) > 0) rates[c] = v;
  }
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || Object.keys(rates).length < 10) throw new Error("The ECB's rate data looks incomplete");
  return { date, rates };
}

/** The currency "category": every unit is a currency, its factor the euros one unit is worth (1 ÷ rate) */
export function currencyCategory(rs: RateSet): Category {
  const list: Unit[] = [{ id: "EUR", name: CURRENCY_NAMES.EUR!, symbol: "EUR", factor: "1" }];
  for (const [code, rate] of Object.entries(rs.rates).sort(([a], [b]) => (CURRENCY_NAMES[a] ?? a).localeCompare(CURRENCY_NAMES[b] ?? b))) {
    if (code === "EUR" || !/^\d+(\.\d+)?$/.test(rate)) continue;
    list.push({ id: code, name: CURRENCY_NAMES[code] ?? code, symbol: code, factor: `1/${rate}` });
  }
  for (const [code, rate] of Object.entries(FIXED_EURO_RATES)) {
    if (!rs.rates[code]) list.push({ id: code, name: CURRENCY_NAMES[code] ?? code, symbol: code, factor: `1/${rate}`, hint: `Fixed at ${rate} per euro` });
  }
  return { id: "currency", name: "Currency", base: "EUR", units: list };
}
