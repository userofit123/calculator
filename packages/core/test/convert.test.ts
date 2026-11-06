import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseNbuJson, parseBcraJson, rateSourceLine, sourceDayOf, CENTRAL_BANK_SOURCES, USD_PEGS, RATE_SOURCES,
  UNIT_CATEGORIES, CONVERT_DIGITS, convert, convertAll, formatDms, parseDms, parseEcbCsv, currencyCategory, currencyFlag, BUNDLED_RATES, mergeRates, retryDelayMs, refreshDue, type Category, type EvalOptions,
} from "../src";

const cat = (id: string) => UNIT_CATEGORIES.find((c) => c.id === id)!;
const cv = (c: string | Category, from: string, to: string, amount: string, o: EvalOptions = {}) => {
  const r = convert(typeof c === "string" ? cat(c) : c, from, to, amount, o);
  return "value" in r ? r.value : "error: " + r.error;
};
const exact = (c: string, from: string, to: string, amount: string) => { const r = convert(cat(c), from, to, amount); return "exact" in r ? r.exact : "error: " + r.error; };
const cases = (c: string, list: [string, string, string, string, EvalOptions?][]) =>
  list.forEach(([amount, from, to, want, o]) => it(`${amount} ${from} = ${want} ${to}`, () => expect(cv(c, from, to, amount, o)).toBe(want)));

describe("length (exact definitions)", () => cases("length", [
  ["1", "foot", "meter", "0.3048"],
  ["1", "mile", "km", "1.609344"],
  ["1", "inch", "cm", "2.54"],
  ["1", "yard", "foot", "3"],
  ["1", "nmi", "meter", "1852"],
  ["1", "lightyear", "km", "9460730472580.8"],
  ["1", "au", "km", "149597870.7"],
  ["72", "point", "inch", "1"],
  ["1", "rack", "inch", "1.75"],
  ["1", "fathom", "foot", "6"],
  ["1", "cable", "fathom", "120"],
  ["1", "parsec", "lightyear", "3.261563777167"],
  ["1", "furlong", "chain", "10"],
  ["1000", "mil", "inch", "1"],
  ["1", "nm", "angstrom", "10"],
]));

describe("area", () => cases("area", [
  ["1", "hectare", "sqm", "10000"],
  ["1", "acre", "sqft", "43560"],
  ["1", "sqmi", "acre", "640"],
  ["1", "sqkm", "hectare", "100"],
  ["1", "sqyd", "sqin", "1296"],
  ["1", "are", "sqm", "100"],
]));

describe("volume", () => cases("volume", [
  ["1", "usgal", "liter", "3.785411784"],
  ["1", "impgal", "imppt", "8"],
  ["1", "usgal", "uspt", "8"],
  ["1", "usqt", "uspt", "2"],
  ["1", "m3", "liter", "1000"],
  ["4", "cup", "liter", "1"],
  ["1", "liter", "ml", "1000"],
  ["1", "ml", "ul", "1000"],
  ["1", "ustbsp", "ustsp", "3"],
  ["1", "uscup", "usfloz", "8"],
  ["1", "ft3", "in3", "1728"],
  ["1", "barrel", "usgal", "42"],
]));

describe("weight", () => cases("mass", [
  ["1", "pound", "kg", "0.45359237"],
  ["1", "pound", "ounce", "16"],
  ["1", "stone", "pound", "14"],
  ["1", "tonne", "kg", "1000"],
  ["1", "troyoz", "gram", "31.1034768"],
  ["1", "gram", "mg", "1000"],
  ["1", "mg", "ug", "1000"],
  ["5", "carat", "gram", "1"],
  ["1", "shortton", "pound", "2000"],
  ["1", "longton", "pound", "2240"],
]));

describe("duration", () => cases("duration", [
  ["1", "day", "hour", "24"],
  ["1", "week", "day", "7"],
  ["1", "year", "day", "365.25"],
  ["1", "century", "decade", "10"],
  ["1", "year", "month", "12"],
  ["1", "second", "ms", "1000"],
  ["1", "ms", "us", "1000"],
  ["1", "us", "ns", "1000"],
  ["90", "minute", "hour", "1.5"],
]));

describe("temperature (offsets)", () => cases("temperature", [
  ["100", "celsius", "fahrenheit", "212"],
  ["0", "celsius", "fahrenheit", "32"],
  ["-40", "celsius", "fahrenheit", "-40"],
  ["0", "celsius", "kelvin", "273.15"],
  ["0", "kelvin", "fahrenheit", "-459.67"],
  ["0", "fahrenheit", "celsius", "-17.777777777778"],
  ["491.67", "rankine", "celsius", "0"],
  ["98.6", "fahrenheit", "celsius", "37"],
  ["300", "kelvin", "rankine", "540"],
  ["37", "celsius", "celsius", "37"],
]));

describe("digital storage", () => cases("storage", [
  ["1", "byte", "bit", "8"],
  ["1", "kibibyte", "byte", "1024"],
  ["1", "kilobyte", "byte", "1000"],
  ["1", "mebibyte", "kibibyte", "1024"],
  ["1", "gigabyte", "megabit", "8000"],
  ["1", "byte", "nibble", "2"],
  ["1", "yobibyte", "byte", "1208925819614629174706176"],
  ["1", "tebibit", "gibibyte", "128"],
]));

describe("speed, frequency, energy, pressure", () => {
  cases("speed", [["36", "kmh", "mps", "10"], ["1", "knot", "kmh", "1.852"], ["60", "mph", "kmh", "96.56064"], ["1", "fps", "mps", "0.3048"]]);
  cases("frequency", [["1", "ghz", "mhz", "1000"], ["1", "thz", "hz", "1000000000000"], ["60", "rpm", "hz", "1"]]);
  cases("energy", [
    ["1", "kwh", "mj", "3.6"], ["1", "kcal", "cal", "1000"], ["1", "cal", "joule", "4.184"], ["1", "joule", "erg", "10000000"],
    ["1", "ev", "joule", "1.602176634×10⁻¹⁹"], ["1", "ftlb", "joule", "1.355817948331"], ["1", "btu", "joule", "1055.05585262"],
  ]);
  cases("pressure", [
    ["1", "atm", "pa", "101325"], ["1", "bar", "kpa", "100"], ["1", "atm", "torr", "760"], ["1", "psi", "pa", "6894.757293168361", { decimals: 12 }],
    ["1", "inhg", "mmhg", "25.4"], ["1", "hpa", "mbar", "1"],
  ]);
});

describe("added categories", () => {
  cases("power", [["1", "kw", "w", "1000"], ["1", "hp", "w", "745.69987158227"], ["1", "ps", "w", "735.49875"]]);
  cases("force", [["1", "kgf", "n", "9.80665"], ["1", "lbf", "n", "4.448221615261"]]);
  cases("fuel", [
    ["5", "l100km", "kml", "20"], ["20", "kml", "l100km", "5"], ["10", "l100km", "mpgus", "23.521458333333"], ["0", "l100km", "kml", "error: Can't convert zero"],
  ]);
  cases("datarate", [["1", "MBps", "Mbps", "8"], ["1", "Gbps", "Mbps", "1000"], ["1", "MiBps", "bps", "8388608"]]);
});

describe("angles", () => {
  cases("angle", [
    ["180", "degree", "radian", "3.14159265359", { decimals: 11 }], ["100", "gradian", "degree", "90"], ["1", "turn", "degree", "360"],
    ["1", "degree", "arcminute", "60"], ["12.5125", "degree", "dms", "12° 30′ 45″"], ["12° 30′ 45″", "dms", "degree", "12.5125"],
    ["-0.5", "degree", "dms", "-0° 30′ 0″"],
  ]);
  it("dms rounding carries", () => expect(formatDms({ q: { n: 359999n, d: 100000n } }, 0)).toBe("3° 36′ 0″"));
  it("parses typed dms", () => { expect(parseDms("10 30")).toEqual({ n: 21n, d: 2n }); expect(parseDms("10")).toBeNull(); });
});

describe("exactness and round trips", () => {
  it("1 ft is exactly 0.3048 m", () => expect(exact("length", "foot", "meter", "1")).toBe("381/1250"));
  it("1 mi is exactly 1.609344 km", () => expect(exact("length", "mile", "km", "1")).toBe("25146/15625"));
  it("1/3 of a foot is exact", () => expect(exact("length", "foot", "inch", "1/3")).toBe("4"));
  it("fahrenheit to celsius is exact", () => expect(exact("temperature", "fahrenheit", "celsius", "0")).toBe("-160/9"));
  for (const c of UNIT_CATEGORIES) {
    it(`${c.name}: every unit round-trips through every other`, () => {
      for (const a of c.units) for (const b of c.units) {
        if (a.dms || b.dms) continue;
        const there = convert(c, a.id, b.id, "7.25", { decimals: 30 });
        expect("exact" in there, `${a.id}→${b.id}`).toBe(true);
        if (!("exact" in there)) continue;
        const back = convert(c, b.id, a.id, there.exact, { decimals: 9 });
        expect("value" in back ? back.value : back.error, `${a.id}→${b.id}→${a.id}`).toBe("7.25");
      }
    });
  }
  it("unit ids are unique per category", () => {
    for (const c of UNIT_CATEGORIES) expect(new Set(c.units.map((u) => u.id)).size).toBe(c.units.length);
  });
  it("expressions are accepted as amounts", () => expect(cv("length", "foot", "inch", "2 + 3 × 2")).toBe("96"));
  it("bad amounts give the engine's error", () => expect(cv("length", "foot", "inch", "2 +")).toMatch(/^error:/));
  it("convertAll lists every unit", () => {
    const all = convertAll(cat("mass"), "kg", "1");
    expect(Array.isArray(all) && all.length).toBe(cat("mass").units.length);
    if (Array.isArray(all)) expect(all.find((x) => x.unit.id === "gram")!.result).toMatchObject({ value: "1000" });
  });
});

describe("currency (ECB euro reference rates)", () => {
  const csv = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE
EXR.D.RUB.EUR.SP00.A,D,RUB,EUR,SP00,A,2022-03-01,117.201
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-11-05,1.1224
EXR.D.JPY.EUR.SP00.A,D,JPY,EUR,SP00,A,2026-11-05,177.85
EXR.D.GBP.EUR.SP00.A,D,GBP,EUR,SP00,A,2026-11-05,0.83393
${["AUD", "CAD", "CHF", "CNY", "CZK", "DKK", "HKD", "HUF", "PLN"].map((c) => `EXR.D.${c}.EUR.SP00.A,D,${c},EUR,SP00,A,2026-11-05,2.5`).join("\n")}
`;
  const rs = parseEcbCsv(csv), cur = currencyCategory(rs);
  it("keeps only the newest day (no stale RUB)", () => { expect(rs.date).toBe("2026-11-05"); expect(rs.rates.RUB).toBeUndefined(); expect(rs.rates.USD).toBe("1.1224"); });
  it("refuses data that isn't the ECB's", () => expect(() => parseEcbCsv("a,b\n1,2")).toThrow());
  it("euro to dollar", () => expect(cv(cur, "EUR", "USD", "100")).toBe("112.24"));
  it("dollar to euro", () => expect(cv(cur, "USD", "EUR", "1.1224")).toBe("1"));
  it("cross rate through the euro", () => expect(cv(cur, "USD", "JPY", "1", { decimals: 6 })).toBe("158.455096"));
  it("cross rate is exact", () => { const r = convert(cur, "GBP", "USD", "0.83393"); expect("exact" in r && r.exact).toBe("1403/1250"); });
  it("fixed euro rates (lev)", () => expect(cv(cur, "BGN", "EUR", "1.95583")).toBe("1"));
  it("euro is first", () => expect(cur.units[0]!.id).toBe("EUR"));
  it("flags are emoji", () => { expect(currencyFlag("USD")).toBe("🇺🇸"); expect(currencyFlag("EUR")).toBe("🇪🇺"); });
  it("legacy euro currencies: only the lev stays", () => { expect(cur.units.some((u) => u.id === "BGN")).toBe(true); expect(cur.units.some((u) => u.id === "HRK" || u.id === "EEK")).toBe(false); });
  const row = (c: string, d: string, v = "2.5") => `EXR.D.${c}.EUR.SP00.A,D,${c},EUR,SP00,A,${d},${v}`;
  const head = "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE";
  const ten = ["AUD", "CAD", "CHF", "CNY", "CZK", "DKK", "HKD", "HUF", "PLN", "SEK"];
  it("a currency missing on the newest day keeps its own newest row and date", () => {
    const r = parseEcbCsv([head, ...ten.map((c) => row(c, "2026-11-05")), row("ISK", "2026-11-04", "137.1"), row("RUB", "2022-03-01")].join("\n"));
    expect(r.date).toBe("2026-11-05"); expect(r.rates.ISK).toBe("137.1"); expect(r.dates).toEqual({ ISK: "2026-11-04" }); expect(r.rates.RUB).toBeUndefined();
    const u = currencyCategory(r).units.find((x) => x.id === "ISK")!;
    expect(u.hint).toBe("Rate of 4 Nov 2026");
    expect(currencyCategory(r).units.find((x) => x.id === "AUD")!.hint).toBeUndefined();
  });
  it("merging keeps a saved currency the new answer lacks, and takes the newest per currency", () => {
    const saved = { date: "2026-11-04", rates: { USD: "1.1", ISK: "137.1", JPY: "170" } };
    const m = mergeRates(saved, { date: "2026-11-05", rates: { USD: "1.2", JPY: "160" } });
    expect(m.date).toBe("2026-11-05"); expect(m.rates).toEqual({ ISK: "137.1", JPY: "160", USD: "1.2" }); expect(m.dates).toEqual({ ISK: "2026-11-04" });
    // an older answer never overwrites a newer saved rate
    expect(mergeRates(m, { date: "2026-11-03", rates: { USD: "9" } }).rates.USD).toBe("1.2");
    // rates far older than the newest day are dropped
    expect(mergeRates({ date: "2026-01-01", rates: { RUB: "100" } }, { date: "2026-11-05", rates: { USD: "1.2" } }).rates.RUB).toBeUndefined();
  });
  it("invalid responses throw, so the saved set is kept", () => {
    expect(() => parseEcbCsv("<html>nope</html>")).toThrow();
    expect(() => parseEcbCsv([head, row("USD", "2026-11-05"), row("JPY", "not-a-date")].join("\n"))).toThrow();
    expect(() => parseEcbCsv([head, ...ten.map((c) => row(c, "2026-11-05", "0"))].join("\n"))).toThrow();
  });
  it("back-off: 30 minutes, doubling, 4 hours at most", () => {
    expect([0, 1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([0, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 14_400_000]);
    const H = 3600_000, now = 100 * H;
    expect(refreshDue(now, now - 5 * H, 0, 0)).toBe(true);
    expect(refreshDue(now, now - 3 * H, 0, 0)).toBe(false);
    expect(refreshDue(now, now - 9 * H, now - 10 * 60_000, 1)).toBe(false);
    expect(refreshDue(now, now - 9 * H, now - 40 * 60_000, 1)).toBe(true);
    expect(refreshDue(now, now - 9 * H, now - 40 * 60_000, 2)).toBe(false);
  });
  it("the bundled snapshot is a full ECB day", () => {
    expect(BUNDLED_RATES.date).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(Object.keys(BUNDLED_RATES.rates).length).toBeGreaterThanOrEqual(25);
    expect(BUNDLED_RATES.rates.USD).toMatch(/^\d+\.\d+$/);
    const r = convert(currencyCategory(BUNDLED_RATES), "USD", "USD", "5");
    expect("value" in r && r.value).toBe("5");
  });
});

describe("currencies from central banks (not quoted by the ECB)", () => {
  const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
  const ecb = { date: "2026-11-05", rates: { USD: "1.1224", JPY: "177.85", GBP: "0.83393" } };
  it("National Bank of Ukraine: the hryvnia rate of the euro and its day", () => {
    expect(parseNbuJson(fixture("nbu.json"))).toEqual({ date: "2026-11-06", rates: { UAH: "51.0406" }, sources: { UAH: "nbu" } });
  });
  it("BCRA: the peso quote of the euro and its day", () => {
    expect(parseBcraJson(fixture("bcra.json"))).toEqual({ date: "2026-11-05", rates: { ARS: "1737.4511" }, sources: { ARS: "bcra" } });
  });
  it("each live source gives only its own currency", () => {
    expect(CENTRAL_BANK_SOURCES.map((s) => [s.id, s.currency])).toEqual([["nbu", "UAH"], ["bcra", "ARS"]]);
    expect(Object.keys(parseNbuJson(fixture("nbu.json")).rates)).toEqual(["UAH"]);
  });
  it("answers that aren't usable throw (so the saved rates stay)", () => {
    const nbu = JSON.parse(fixture("nbu.json")) as { cc: string; rate: unknown; exchangedate: string }[];
    const without = (f: (x: (typeof nbu)[number]) => void) => JSON.stringify(nbu.map((x) => { const y = { ...x }; if (y.cc === "EUR") f(y); return y; }));
    for (const bad of ["<html>busy</html>", "{}", "[]", without((x) => { x.rate = 0; }), without((x) => { x.rate = "51"; }), without((x) => { x.exchangedate = "2026-11-06"; }), without((x) => { x.cc = "XXX"; })]) {
      expect(() => parseNbuJson(bad)).toThrow();
    }
    // impossible calendar days are refused, real ones (leap day) pass
    for (const d of ["31.02.2026", "29.02.2026", "31.04.2026", "00.11.2026"]) expect(() => parseNbuJson(without((x) => { x.exchangedate = d; }))).toThrow();
    expect(parseNbuJson(without((x) => { x.exchangedate = "29.02.2028"; })).date).toBe("2028-02-29");
    const bcra = JSON.parse(fixture("bcra.json")) as { results: { fecha: string; detalle: { codigoMoneda: string; tipoCotizacion: unknown }[] } };
    const alter = (f: (b: typeof bcra) => void) => { const b = structuredClone(bcra); f(b); return JSON.stringify(b); };
    for (const d of ["2026-02-31", "2026-13-01", "2026-04-31"]) expect(() => parseBcraJson(alter((b) => { b.results.fecha = d; }))).toThrow();
    expect(parseBcraJson(alter((b) => { b.results.fecha = "2028-02-29"; })).date).toBe("2028-02-29");
    for (const bad of ["not json", "{\"status\":400,\"errorMessages\":[\"x\"]}", alter((b) => { b.results.fecha = "5/11/2026"; }),
      alter((b) => { b.results.detalle = b.results.detalle.filter((x) => x.codigoMoneda !== "EUR"); }),
      alter((b) => { b.results.detalle.find((x) => x.codigoMoneda === "EUR")!.tipoCotizacion = -1; })]) {
      expect(() => parseBcraJson(bad)).toThrow();
    }
  });
  it("merging keeps each rate's source and day; a failed source keeps its saved rate", () => {
    const m = mergeRates(mergeRates(ecb, parseNbuJson(fixture("nbu.json"))), parseBcraJson(fixture("bcra.json")));
    expect(m.date).toBe("2026-11-06");
    expect(m.sources).toEqual({ ARS: "bcra", UAH: "nbu" });
    expect(m.dates).toEqual({ ARS: "2026-11-05", GBP: "2026-11-05", JPY: "2026-11-05", USD: "2026-11-05" });
    expect(sourceDayOf(m, "ecb")).toBe("2026-11-05");
    // a newer ECB day alone (the banks failed): the hryvnia and peso keep their rate, day and source
    const n = mergeRates(m, { date: "2026-11-09", rates: { USD: "1.13" } });
    expect(n.rates.UAH).toBe("51.0406"); expect(n.sources).toEqual({ ARS: "bcra", UAH: "nbu" }); expect(n.dates!.UAH).toBe("2026-11-06");
    expect(n.sources!.USD).toBeUndefined();
  });
  it("shows the bank and the day of each rate", () => {
    const m = mergeRates(mergeRates(ecb, parseNbuJson(fixture("nbu.json"))), parseBcraJson(fixture("bcra.json")));
    const cur = currencyCategory(m), hint = (id: string) => cur.units.find((u) => u.id === id)?.hint;
    expect(hint("UAH")).toBe("National Bank of Ukraine, 6 Nov 2026");
    expect(hint("ARS")).toBe("Central Bank of Argentina, 5 Nov 2026");
    expect(hint("USD")).toBeUndefined(); // the ECB's newest day: no note
    expect(rateSourceLine(m, "USD")).toBe("European Central Bank reference rates, 5 Nov 2026");
    expect(cv(cur, "EUR", "UAH", "2")).toBe("102.0812");
    expect(cv(cur, "UAH", "ARS", "51.0406", { decimals: 4 })).toBe("1737.4511");
  });
  it("dollar pegs: peg × the ECB's dollar rate, exactly", () => {
    const cur = currencyCategory(ecb), hint = (id: string) => cur.units.find((u) => u.id === id)?.hint;
    expect(cv(cur, "USD", "AED", "1")).toBe("3.6725");
    expect(cv(cur, "SAR", "USD", "3.75")).toBe("1");
    expect(cv(cur, "EUR", "SAR", "1")).toBe("4.209");
    const r = convert(cur, "AED", "SAR", "3.6725"); expect("exact" in r && r.exact).toBe("15/4");
    expect(hint("AED")).toBe("Fixed at 3.6725 per US dollar (Central Bank of the UAE) · ECB dollar rate of 5 Nov 2026");
    expect(Object.keys(USD_PEGS).every((c) => cur.units.some((u) => u.id === c))).toBe(true);
    // with no dollar rate there is nothing to work them out from: left out
    expect(currencyCategory({ date: "2026-11-05", rates: { JPY: "177.85" } }).units.some((u) => u.id === "AED")).toBe(false);
  });
  it("CFA francs: fixed euro parity", () => {
    const cur = currencyCategory(ecb);
    expect(cv(cur, "EUR", "XOF", "1")).toBe("655.957");
    expect(cv(cur, "XAF", "XOF", "100")).toBe("100");
    expect(cur.units.find((u) => u.id === "XOF")!.hint).toBe("Fixed at 655.957 per euro (BCEAO)");
  });
  it("the bundled snapshot has the central banks' currencies with their sources", () => {
    for (const s of CENTRAL_BANK_SOURCES) {
      expect(BUNDLED_RATES.rates[s.currency]).toMatch(/^\d+(\.\d+)?$/);
      expect(BUNDLED_RATES.sources?.[s.currency]).toBe(s.id);
    }
  });
});

describe("rate source ids are own keys", () => {
  it("RATE_SOURCES has no inherited ids", () => {
    expect(Object.hasOwn(RATE_SOURCES, "nbu")).toBe(true);
    for (const k of ["toString", "constructor", "__proto__"]) expect(Object.hasOwn(RATE_SOURCES, k)).toBe(false);
  });
});

describe("shown to the converter's significant digits", () => {
  const o: EvalOptions = { decimals: 10, significant: CONVERT_DIGITS };
  it("cuts the long decimals", () => {
    expect(cv("mass", "kg", "pound", "1000", o)).toBe("2204.622622");
    expect(cv("mass", "kg", "pound", "1000", { decimals: 10 })).toBe("2204.6226218488");
    expect(cv("speed", "kmh", "mph", "100", o)).toBe("62.13711922");
    expect(cv("length", "meter", "foot", "1", o)).toBe("3.280839895");
  });
  it("keeps every digit of a whole number and short values as they are", () => {
    expect(cv("storage", "terabyte", "byte", "123", o)).toBe("123000000000000");
    expect(cv("length", "km", "meter", "1.5", o)).toBe("1500");
    expect(cv("length", "meter", "cm", "0.25", o)).toBe("25");
  });
  it("small values keep their significant digits, up to the decimals chosen", () => {
    expect(cv("length", "mm", "meter", "1.23456789", o)).toBe("0.0012345679");
    expect(cv("length", "foot", "meter", "1", { decimals: 3, significant: CONVERT_DIGITS })).toBe("0.305");
  });
});
