// Unit conversions typed into the calculator ("5 km in mi", "20 USD in EUR"): the conversion code and the currency
// rates are loaded only when a sum first asks for them (the rates module carries the bundled snapshot and the rates
// saved on this device, as the Converter uses them; nothing is downloaded for this). Until then a conversion says it is
// loading, and the answers appear by themselves once it has (the preview and the display read `units`).
import { shallowReactive, markRaw } from "vue";
import { isConversion, UNITS_LOADING, RATES_LOADING, type EvalOptions, type EvalResult, type RateSet } from "@calc/core";

export const units = shallowReactive({
  convert: null as EvalOptions["convert"] | null,
  rates: null as { set: RateSet } | null,
});
let unitsP: Promise<void> | null = null, ratesP: Promise<void> | null = null;
// (a failed load is forgotten, so the next try starts again)
export const loadUnits = () => (unitsP ??= import("./unitConv").then((m) => { units.convert = markRaw(m.convertExpression); }, (e) => { unitsP = null; throw e; }));
export const loadRates = () => (ratesP ??= import("./rates").then((m) => { units.rates = m.rates; }, (e) => { ratesP = null; throw e; }));

/** The options a sum needs for a conversion (and starts loading what it lacks) */
export function unitOptions(expr: string): Partial<EvalOptions> {
  if (!isConversion(expr)) return {};
  if (!units.convert) { loadUnits().catch(() => {}); return {}; }
  return { convert: units.convert, ...(units.rates ? { rates: units.rates.set } : {}) };
}
/** Is the result only waiting for the conversion code or the rates? Starts loading the rates when they are missing. */
export function waiting(r: EvalResult): boolean {
  if (!("error" in r)) return false;
  if (r.error === RATES_LOADING) { loadRates().catch(() => {}); return true; }
  return r.error === UNITS_LOADING;
}
/** Loads whatever a conversion still waits for (the code first, then the rates if it turns out to need them) */
export async function ready(again: () => EvalResult): Promise<void> {
  await loadUnits();
  const r = again();
  if ("error" in r && r.error === RATES_LOADING) await loadRates();
}
