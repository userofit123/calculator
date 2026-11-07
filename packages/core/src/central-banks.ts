// Official rates from the central banks of countries whose currency the ECB doesn't quote. Only banks that publish their
// own euro rate in a form a web page may read (a JSON answer that allows any site) are here; each gives one currency, its
// own, as units per euro, exactly as the bank publishes it. Both answers are checked strictly: anything unexpected
// throws, so the rates already held are kept. docs/currency-sources.md lists the banks that were checked and why the
// others are missing.
import { isDay, type RateSet } from "./currency";

/** National Bank of Ukraine: the official hryvnia rates of the day (UAH per unit of each currency), JSON, open to any site */
export const NBU_RATES_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";
/** Central Bank of Argentina (BCRA): its official quotes of the latest day (ARS per unit of each currency), JSON, open to any site */
export const BCRA_RATES_URL = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones";

/** The live central-bank sources: id (RateSet.sources), address, the one currency it gives, and its reader */
export const CENTRAL_BANK_SOURCES: { id: string; url: string; currency: string; parse: (text: string) => RateSet }[] = [
  { id: "nbu", url: NBU_RATES_URL, currency: "UAH", parse: (t) => parseNbuJson(t) },
  { id: "bcra", url: BCRA_RATES_URL, currency: "ARS", parse: (t) => parseBcraJson(t) },
];

/** A positive JSON number as the plain decimal it was published as ("51.0406"), or null */
function decimal(n: unknown): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const s = String(n);
  return /^\d+(\.\d+)?$/.test(s) ? s : null;
}

/** Reads the National Bank of Ukraine's answer: the hryvnia rate of the euro (r030 978) and its day ("06.11.2026") */
export function parseNbuJson(text: string): RateSet {
  let list: unknown;
  try { list = JSON.parse(text); } catch { throw new Error("Not the National Bank of Ukraine's rate data"); }
  if (!Array.isArray(list) || list.length < 10) throw new Error("Not the National Bank of Ukraine's rate data");
  const eur = list.find((x) => x && typeof x === "object" && (x as { cc?: unknown }).cc === "EUR") as { r030?: unknown; rate?: unknown; exchangedate?: unknown } | undefined;
  const v = decimal(eur?.rate), m = typeof eur?.exchangedate === "string" ? /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(eur.exchangedate) : null;
  const date = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  if (!eur || eur.r030 !== 978 || !v || !isDay(date)) throw new Error("The National Bank of Ukraine's rate data looks incomplete");
  return { date, rates: { UAH: v }, sources: { UAH: "nbu" } };
}

/** Reads the BCRA's answer: the peso quote of the euro (tipoCotizacion, ARS per euro) on its day (fecha) */
export function parseBcraJson(text: string): RateSet {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("Not the BCRA's rate data"); }
  const res = (data as { results?: { fecha?: unknown; detalle?: unknown } } | null)?.results;
  if (!res || !Array.isArray(res.detalle) || res.detalle.length < 5) throw new Error("Not the BCRA's rate data");
  const eur = res.detalle.find((x) => x && typeof x === "object" && (x as { codigoMoneda?: unknown }).codigoMoneda === "EUR") as { tipoCotizacion?: unknown } | undefined;
  const v = decimal(eur?.tipoCotizacion), date = typeof res.fecha === "string" ? res.fecha : "";
  if (!v || !isDay(date)) throw new Error("The BCRA's rate data looks incomplete");
  return { date, rates: { ARS: v }, sources: { ARS: "bcra" } };
}
