// Unit conversions typed straight into the calculator, like GNOME's: "5 km in mi", "5 kilometers to miles",
// "100 degF in degC", "20 USD in EUR". The amount is any expression; the units and rates are the Converter's own
// (units.ts, currency.ts), worked out the same exact way (convert.ts: through the category's base unit, temperatures
// with their offset). The answer is a plain number; the unit it is in comes with it for the display.
// Units are looked up only here, after a number and around "in"/"to", so a unit's name never hides a variable, a
// function or a constant (g, e, pi, ans) anywhere else. Symbols are matched case first ("mm" is not "Mm", "MB" is not
// "Mb"); names, plurals and currency codes in any case. A spelling that fits several units asks which one.
import { evaluate, isConversion, RATES_LOADING, type EvalOptions, type EvalResult } from "./evaluate";
import { formatValue, exactText, parseStored } from "./format";
import { CalcError } from "./rational";
import { UNIT_CATEGORIES, type Category, type Unit } from "./units";
import { toBase, fromBase } from "./convert";
import { currencyCategory, rateSourceLine, CURRENCY_NAMES, FIXED_EURO_RATES, USD_PEGS, type RateSet } from "./currency";

interface Entry { cat: Category; unit: Unit }

/** One spelling for lookup: spaces evened out, ÷ for /, superscript powers and ^2 as plain digits (m² = m^2 = m2),
 *  µ and μ as u (µm = um) */
const norm = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[÷∕]/g, "/").replace(/[×*⋅]/g, "·").replace(/²|\^2/g, "2").replace(/³|\^3/g, "3")
    .replace(/[µμ]/g, "u");

/** Spellings people type that aren't a unit's symbol, name or alias, by category:unit id. `cs` ones keep their case. */
const EXTRA: Record<string, { cs?: string[]; ci?: string[] }> = {
  "temperature:celsius": { cs: ["degC", "C", "℃"], ci: ["deg c", "degrees celsius"] },
  "temperature:fahrenheit": { cs: ["degF", "F", "℉"], ci: ["deg f", "degrees fahrenheit"] },
  "temperature:kelvin": { cs: ["degK"], ci: ["kelvins"] },
  "temperature:rankine": { cs: ["degR"] },
  "angle:degree": { ci: ["deg", "degs"] },
  "angle:radian": { ci: ["rads"] },
  "length:meter": { ci: ["meters", "metres"] },
  "length:mile": { ci: ["mile", "miles"] },
  "length:foot": { ci: ["feet", "foot"] },
  "length:inch": { ci: ["inch", "inches"] },
  "length:point": { ci: ["point", "points"] },
  "length:km": { ci: ["kms"] },
  "area:sqm": { ci: ["sq m", "sqm", "square metres"] },
  "area:sqkm": { ci: ["sq km", "sqkm"] },
  "area:sqmi": { ci: ["sq mi", "sqmi"] },
  "area:sqft": { ci: ["sq ft", "sqft"] },
  "area:sqin": { ci: ["sq in", "sqin"] },
  "area:sqyd": { ci: ["sq yd", "sqyd"] },
  "area:sqcm": { ci: ["sq cm", "sqcm"] },
  "area:sqmm": { ci: ["sq mm", "sqmm"] },
  "volume:liter": { cs: ["l"], ci: ["ltr", "litre", "litres", "liter", "liters"] },
  "volume:ml": { ci: ["ml"] },
  "volume:usgal": { ci: ["gal", "gallon", "gallons", "us gal", "us gallon", "us gallons"] },
  "volume:impgal": { ci: ["gal", "gallon", "gallons", "uk gal", "imp gal", "uk gallon", "uk gallons", "imp gallon", "imp gallons", "imperial gal"] },
  "volume:uspt": { ci: ["pint", "pints", "us pint", "us pints", "us pt"] },
  "volume:imppt": { ci: ["pint", "pints", "uk pint", "uk pints", "imp pint", "imp pints", "uk pt", "imp pt"] },
  "volume:usqt": { ci: ["qt", "quart", "quarts"] },
  "volume:impqt": { ci: ["qt", "quart", "quarts"] },
  "volume:usfloz": { ci: ["fl oz", "floz", "fluid ounce", "fluid ounces", "us fl oz", "us floz"] },
  "volume:impfloz": { ci: ["fl oz", "floz", "fluid ounce", "fluid ounces", "uk fl oz", "uk floz", "imp fl oz", "imp floz"] },
  "volume:ft3": { ci: ["cu ft", "cubic foot"] },
  "volume:in3": { ci: ["cu in", "cubic inch"] },
  "volume:yd3": { ci: ["cu yd", "cubic yard"] },
  "mass:pound": { ci: ["lbs", "pound", "pounds"] },
  "mass:shortton": { ci: ["ton", "tons", "short ton", "short tons", "us ton", "us tons"] },
  "mass:longton": { ci: ["ton", "tons", "long ton", "long tons", "uk ton", "uk tons", "imperial ton"] },
  "duration:hour": { ci: ["hrs"] },
  "duration:minute": { ci: ["mins"] },
  "duration:second": { ci: ["secs"] },
  "duration:year": { ci: ["yrs"] },
  "storage:kilobyte": { cs: ["KB"] },
  "storage:kilobit": { cs: ["Kb"] },
  "speed:kmh": { ci: ["kmph", "kph"] },
};
/** Alias words that don't name the unit on their own ("metric ton" names the tonne, "metric" doesn't) */
const NOT_ALONE = /* @__PURE__ */ new Set(["decimal", "mechanical", "metric", "imperial", "ton", "gallon", "pint", "mil"]);

/** A name's singular: "Kilometers" → "kilometer", "Inches" → "inch", "Centuries" → "century", "Feet" → "foot" */
const singular = (w: string) =>
  w === "feet" ? "foot" : /ies$/.test(w) ? w.slice(0, -3) + "y" : /(ch|sh)es$/.test(w) ? w.slice(0, -2) : /[^su]s$/.test(w) ? w.slice(0, -1) : w;
/** A name with its other spellings: the singular (of the first word too: "mile per hour"), metre and litre */
function nameForms(name: string): string[] {
  const n = name.toLowerCase(), words = n.split(" ");
  const forms = new Set([n, [...words.slice(0, -1), singular(words.at(-1)!)].join(" "), [singular(words[0]!), ...words.slice(1)].join(" ")]);
  for (const f of [...forms]) forms.add(f.replace(/meter/g, "metre").replace(/liter/g, "litre"));
  return [...forms];
}

interface Tables { cs: Map<string, Entry[]>; ci: Map<string, Entry[]>; sym: Map<string, Entry[]> }
let tables: Tables | null = null;
const put = (m: Map<string, Entry[]>, k: string, e: Entry) => {
  const l = m.get(k);
  if (!l) m.set(k, [e]);
  else if (!l.some((x) => x.unit === e.unit && x.cat === e.cat)) l.push(e);
};
/** The lookup tables, built once: cs (exact case: symbols, extras, mixed-case ids like kBps), ci (lowercase: names,
 *  plurals, aliases, ids), sym (symbols lowercased, used only for a spelling typed all in one case: "KM", "mb") */
function build(): Tables {
  const t: Tables = { cs: new Map(), ci: new Map(), sym: new Map() };
  for (const cat of UNIT_CATEGORIES) {
    for (const unit of cat.units) {
      if (unit.dms) continue; // degrees, minutes and seconds is a way of showing, not a number
      const e = { cat, unit }, sym = norm(unit.symbol);
      put(t.cs, sym, e); put(t.sym, sym.toLowerCase(), e);
      if (/[A-Z]/.test(unit.id)) put(t.cs, unit.id, e);
      else if (unit.id.length >= 3) put(t.ci, unit.id, e);
      for (const f of nameForms(unit.name)) put(t.ci, norm(f), e);
      if (unit.alias) {
        put(t.ci, norm(unit.alias.toLowerCase()), e);
        for (const w of unit.alias.toLowerCase().split(" ")) if (!NOT_ALONE.has(w)) put(t.ci, norm(w), e);
      }
      const x = EXTRA[`${cat.id}:${unit.id}`];
      for (const s of x?.cs ?? []) put(t.cs, norm(s), e);
      for (const s of x?.ci ?? []) put(t.ci, norm(s.toLowerCase()), e);
    }
  }
  return t;
}

// (built on first use, and marked pure: the first screen's bundle imports this file's package but never runs it)
const knownCode = (c: string) => c in CURRENCY_NAMES || c in FIXED_EURO_RATES || c in USD_PEGS;
const currencyCache = /* @__PURE__ */ new WeakMap<RateSet, Category>();
const currencies = (rs: RateSet) => {
  let c = currencyCache.get(rs);
  if (!c) currencyCache.set(rs, (c = currencyCategory(rs)));
  return c;
};
/** A currency by its code (any case) or its name ("euros", "US dollars"); "loading" while there are no rates yet */
function findCurrency(text: string, rs: RateSet | undefined): Entry[] | "loading" {
  const s = norm(text).toLowerCase();
  let code = /^[a-z]{3}$/.test(s) && knownCode(s.toUpperCase()) ? s.toUpperCase() : "";
  if (!code) {
    for (const [c, n] of Object.entries(CURRENCY_NAMES)) {
      const nm = n.toLowerCase();
      if (s === nm || s === nm + "s" || (c === "EUR" && s === "euros")) { code = c; break; }
    }
  }
  if (!code) return [];
  if (!rs) return "loading";
  const cat = currencies(rs), unit = cat.units.find((u) => u.id === code);
  if (!unit) throw new CalcError(`No rate for ${code}`);
  return [{ cat, unit }];
}

/** Every unit a spelling can mean (several when it is ambiguous), or "loading" for a currency without rates yet */
export function findUnits(text: string, rs?: RateSet): Entry[] | "loading" {
  const t = (tables ??= build()), s = norm(text);
  if (!s) return [];
  const exact = t.cs.get(s);
  if (exact) return exact;
  const cur = findCurrency(s, rs);
  if (cur === "loading" || cur.length) return cur;
  const byName = t.ci.get(s.toLowerCase());
  if (byName) return byName;
  // a symbol typed in the wrong case only when it is all one case: "KM" is km, "mb" asks MB or Mb, but "Mm" isn't mm
  return s === s.toLowerCase() || s === s.toUpperCase() ? t.sym.get(s.toLowerCase()) ?? [] : [];
}

/** "kilometers", "US gallons": a unit's name as it reads mid-sentence */
const nameOf = (u: Unit) => (/^(?!British|Celsius|Fahrenheit|Kelvin|Rankine|Torr|Ångström)[A-Z][a-z]/.test(u.name) ? u.name[0]!.toLowerCase() + u.name.slice(1) : u.name);
const which = (l: Entry[]) => `Which unit: ${l.map((e) => nameOf(e.unit)).join(" or ")}?`;

/** Where the amount ends and the unit begins: after a space, or where a letter follows a digit or ")" ("5km",
 *  "(1+2)ft"); the longest unit first ("2 light years" is light years, not years) */
function unitStarts(left: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < left.length; i++) {
    const p = left[i - 1]!, c = left[i]!;
    if (/\s/.test(c)) continue;
    if (/\s/.test(p) || (/[\d.)]/.test(p) && /[\p{L}°℃℉µ]/u.test(c))) out.push(i);
  }
  return out;
}

/** The inside of a text that is wholly one bracket pair ("(5 km)" gives "5 km"), else "" */
function unwrap(text: string): string {
  const t = text.trim();
  if (!t.startsWith("(") || !t.endsWith(")")) return "";
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") depth++;
    else if (t[i] === ")" && --depth === 0 && i < t.length - 1) return "";
  }
  return depth === 0 ? t.slice(1, -1) : "";
}

/** The places "in" / "to" may split the text, outside brackets, the last one first ("5 in in cm" splits at the second) */
function splitPoints(src: string): { left: string; right: string }[] {
  const out: { left: string; right: string }[] = [];
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth <= 0) {
      const m = /^\s(?:in|to)\s/i.exec(src.slice(i, i + 4));
      if (m) out.push({ left: src.slice(0, i), right: src.slice(i + 4) });
    }
  }
  return out.reverse();
}

/** Narrows the two sides to units of one category; errors when none or several are left */
function pick(from: Entry[], to: Entry[]): [Entry, Entry] {
  const pairs = from.flatMap((f) => to.filter((t) => t.cat === f.cat).map((t) => [f, t] as [Entry, Entry]));
  if (!pairs.length) {
    if (from.length > 1) throw new CalcError(which(from));
    if (to.length > 1) throw new CalcError(which(to));
    throw new CalcError(`Can't convert ${nameOf(from[0]!.unit)} to ${nameOf(to[0]!.unit)}`);
  }
  const fs = [...new Set(pairs.map((p) => p[0]))], ts = [...new Set(pairs.map((p) => p[1]))];
  if (fs.length > 1) throw new CalcError(which(fs));
  if (ts.length > 1) throw new CalcError(which(ts));
  return pairs[0]!;
}

const bad = (text: string) => new CalcError(`Unknown unit ${norm(text) || "after in"}`);

/** Works out "<amount> <unit> in|to <unit>": the hook evaluate() takes as `convert` (see EvalOptions) */
export function convertExpression(src: string, o: EvalOptions): EvalResult {
  const splits = splitPoints(src);
  let right: { text: string; units: Entry[] } | null = null, left = "";
  for (const s of splits) {
    const u = findUnits(s.right, o.rates);
    if (u === "loading") return { error: RATES_LOADING };
    if (u.length) { right = { text: s.right, units: u }; left = s.left; break; }
  }
  if (!right) throw bad(splits[0]?.right ?? "");
  if (!left.trim()) throw new CalcError("Type an amount and its unit first: 5 km in mi");
  // the unit converted from: the longest end of the left side that is one
  let from: { amount: string; units: Entry[] } | null = null;
  // "(5 km) in mi": a whole left side in brackets is looked into when it has no unit outside them
  for (let l = left, tries = 0; !from && tries < 4; tries++) {
    for (const i of unitStarts(l)) {
      const text = l.slice(i), u = findUnits(text, o.rates);
      if (u === "loading") return { error: RATES_LOADING };
      if (u.length) { from = { amount: l.slice(0, i).trim(), units: u }; break; }
    }
    const inner = from ? "" : unwrap(l);
    if (!inner) break;
    l = inner;
  }
  if (!from) {
    // "5 in mi": no unit to convert from
    const lastWord = /(\S+)\s*$/.exec(left)?.[1] ?? "";
    throw new CalcError(/^[\d.)]+$/.test(lastWord) ? "Type the unit it is in: 5 km in mi" : `Unknown unit ${lastWord}`);
  }
  const [f, t] = pick(from.units, right.units);
  // the amount is worked out by the same engine and settings, and can't itself be a conversion or store a variable
  if (isConversion(from.amount)) throw new CalcError("One conversion at a time");
  const a = evaluate(from.amount, { ...o, convert: undefined });
  if ("error" in a) return a;
  if (a.assigned) return { error: "Can't store a variable here" };
  let v;
  try { v = fromBase(t.unit, toBase(f.unit, parseStored(a.exact))); } catch (e) {
    if (e instanceof CalcError && e.message === "Division by zero") throw new CalcError("Can't convert zero");
    throw e;
  }
  const notes = f.cat.id === "currency" && o.rates
    ? [...new Set([f.unit.id, t.unit.id].map((c) => rateSourceLine(o.rates!, c)).filter(Boolean))]
    : [];
  return { value: formatValue(v, o), exact: exactText(v), unit: t.unit.symbol, ...(notes.length ? { note: notes.join(" · ") } : {}) };
}

/** evaluate() with unit conversions switched on (and the rates for currencies, when given) */
export const evaluateUnits = (src: string, o: EvalOptions = {}): EvalResult => evaluate(src, { ...o, convert: convertExpression });
