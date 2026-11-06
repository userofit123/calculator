import { describe, expect, it } from "vitest";
import { evaluate, evaluateUnits, findUnits, isConversion, UNITS_LOADING, RATES_LOADING, type EvalOptions, type RateSet } from "../src";

/** a fixed set of rates, so the answers don't move with the bundled snapshot */
const RATES: RateSet = { date: "2026-11-05", rates: { USD: "1.25", GBP: "0.8", JPY: "160", UAH: "45" }, sources: { UAH: "nbu" }, dates: { UAH: "2026-11-04" } };
const ev = (s: string, o: EvalOptions = {}) => {
  const r = evaluateUnits(s, { decimals: 10, ...o });
  return "value" in r ? `${r.value}${r.unit ? " " + r.unit : ""}` : "error: " + r.error;
};
const ex = (s: string, o: EvalOptions = {}) => { const r = evaluateUnits(s, o); return "exact" in r ? r.exact : "error: " + r.error; };
const cases = (list: [string, string, EvalOptions?][]) => list.forEach(([s, want, o]) => it(`${s} = ${want}`, () => expect(ev(s, o)).toBe(want)));

describe("lengths", () => cases([
  ["5 km in mi", "3.1068559612 mi"],
  ["5 mi in km", "8.04672 km"],
  ["5 kilometers to miles", "3.1068559612 mi"],
  ["1 ft in m", "0.3048 m"],
  ["12 in in ft", "1 ft"],
  ["5 m in in", "196.8503937008 in"],
  ["1 mile in feet", "5280 ft"],
  ["3 yards to inches", "108 in"],
  ["5km in m", "5000 m"],
  ["(2+3) km in m", "5000 m"],
  ["2 light years in km", "18921460945161.6 km"],
  ["1000 µm in mm", "1 mm"],
  ["1000 um in mm", "1 mm"],
  ["2 KM in M", "2000 m"],
  ["1 metre in centimetres", "100 cm"],
]));

describe("areas and volumes", () => cases([
  ["1 ha in m²", "10000 m²"],
  ["1 ha in m2", "10000 m²"],
  ["1 acre in sq ft", "43560 ft²"],
  ["1 km^2 in ha", "100 ha"],
  ["1 m3 in L", "1000 L"],
  ["1 US gallons in liters", "3.785411784 L"],
  ["1 British gallon in pints (UK)", "error: Unknown unit pints (UK)"],
  ["8 pt (US) in gal (US)", "1 gal (US)"],
  ["1 l in ml", "1000 mL"],
  ["1 cu ft in L", "28.316846592 L"],
]));

describe("temperatures (affine)", () => cases([
  ["100 degC in degF", "212 °F"],
  ["100 degF in degC", "37.7777777778 °C"],
  ["-40 °C in °F", "-40 °F"],
  ["0 K in degC", "-273.15 °C"],
  ["32 fahrenheit to celsius", "0 °C"],
  ["300 kelvin in celsius", "26.85 °C"],
  ["20 C in F", "68 °F"],
]));
it("temperature answers are exact fractions", () => expect(ex("100 degF in degC")).toBe("340/9"));

describe("data, time and the rest", () => cases([
  ["1 GiB in MiB", "1024 MiB"],
  ["1 GB in MB", "1000 MB"],
  ["1 MB in Mb", "8 Mb"],
  ["1 KB in B", "1000 B"],
  ["1 byte in bits", "8 b"],
  ["2 h in min", "120 min"],
  ["1 day in seconds", "86400 s"],
  ["90 minutes to hours", "1.5 h"],
  ["1 week in days", "7 d"],
  ["100 km/h in m/s", "27.7777777778 m/s"],
  ["60 mph in kmh", "96.56064 km/h"],
  ["1 lb in g", "453.59237 g"],
  ["1 kg in lbs", "2.2046226218 lb"],
  ["180 deg in rad", "3.1415926536 rad"],
  ["1 atm in kPa", "101.325 kPa"],
  ["1 kWh in J", "3600000 J"],
]));

describe("currency", () => {
  const o = { rates: RATES };
  cases([
    ["20 USD in EUR", "16 EUR", o],
    ["20 usd in eur", "16 EUR", o],
    ["10 EUR to GBP", "8 GBP", o],
    ["100 JPY in USD", "0.78125 USD", o],
    ["1 euro in US dollars", "1.25 USD", o],
    ["1 USD in AED", "3.6725 AED", o],
  ]);
  it("says where the rate came from", () => {
    const r = evaluateUnits("20 USD in UAH", o);
    expect("note" in r && r.note).toBe("European Central Bank reference rates, 5 Nov 2026 · National Bank of Ukraine, 4 Nov 2026");
  });
  it("without rates: loading", () => expect(ev("20 USD in EUR")).toBe("error: " + RATES_LOADING));
  it("a code with no rate", () => expect(ev("1 USD in CHF", o)).toBe("error: No rate for CHF"));
  it("can't mix currencies and units", () => expect(ev("1 USD in km", o)).toBe("error: Can't convert US dollar to kilometers"));
});

describe("errors", () => cases([
  ["5 km in kg", "error: Can't convert kilometers to kilograms"],
  ["5 km in foo", "error: Unknown unit foo"],
  ["5 foo in km", "error: Unknown unit foo"],
  ["5 in mi", "error: Type the unit it is in: 5 km in mi"],
  [" in mi", "error: Type an amount and its unit first: 5 km in mi"],
  ["1 mb in kB", "error: Which unit: megabits or megabytes?"],
  ["1 gal in L", "error: Which unit: British gallons or US gallons?"],
  ["1 Mm in m", "error: Unknown unit Mm"],
  ["x km in mi", "error: Unknown variable x"],
  ["0 L/100 km in km/L", "error: Can't convert zero"],
  ["x = 5 km in mi", "error: Can't store a variable here"],
]));

describe("units are only looked up around in / to", () => {
  it("5 m alone is not a length", () => expect(ev("5 m")).toBe("error: Unknown variable m"));
  it("5 m in m", () => expect(ev("5 m in m")).toBe("5 m"));
  it("g is still a variable", () => expect(ev("2g", { variables: { g: "3" } })).toBe("6"));
  it("e and pi are constants, not units", () => { expect(ev("2 e")).toBe(ev("2×e")); expect(ev("e m in cm")).toBe("271.8281828459 cm"); });
  it("a variable as the amount", () => expect(ev("d km in m", { variables: { d: "3" } })).toBe("3000 m"));
  it("ans as the amount", () => expect(ev("ans mi in km", { ans: "1" })).toBe("1.609344 km"));
  it("in inside brackets is not a conversion", () => expect(isConversion("sin(2 in 3)")).toBe(false));
  it("in as a word only", () => expect(isConversion("sin 30 + min")).toBe(false));
  it("in and to can't be variables", () => {
    expect(evaluate("in = 5")).toEqual({ error: "in is kept for unit conversions (5 km in mi)" });
    expect(evaluate("to = 5")).toEqual({ error: "to is kept for unit conversions (5 km in mi)" });
  });
  it("without the converter: loading", () => expect(evaluate("5 km in mi")).toEqual({ error: UNITS_LOADING }));
  it("existing sums are unchanged", () => {
    for (const s of ["2+3", "sin 30", "2^10", "1/3*3", "5 mod 3", "log(8; 2)", "2π", "x = 5", "√16", "10%"]) expect(evaluateUnits(s)).toEqual(evaluate(s));
  });
});

describe("lookup", () => {
  it("symbols keep their case", () => {
    expect((findUnits("mm") as { unit: { id: string } }[]).map((e) => e.unit.id)).toEqual(["mm"]);
    expect(findUnits("Mm")).toEqual([]);
    expect((findUnits("MB") as { unit: { id: string } }[]).map((e) => e.unit.id)).toEqual(["megabyte"]);
    expect((findUnits("Mb") as { unit: { id: string } }[]).map((e) => e.unit.id)).toEqual(["megabit"]);
  });
  it("names, plurals and singulars", () => {
    for (const s of ["kilometer", "kilometers", "Kilometres", "km"]) expect((findUnits(s) as { unit: { id: string } }[])[0]?.unit.id).toBe("km");
    expect((findUnits("inches") as { unit: { id: string } }[])[0]?.unit.id).toBe("inch");
    expect((findUnits("centuries") as { unit: { id: string } }[])[0]?.unit.id).toBe("century");
  });
  it("e, pi and ans are not units", () => { for (const s of ["e", "pi", "ans", "sin"]) expect(findUnits(s)).toEqual([]); });
});

describe("format and exactness", () => {
  it("follows the number format", () => expect(ev("1 in in cm", { format: "fraction" })).toBe("127/50 cm"));
  it("exact answers stay exact", () => expect(ex("1 ft in m")).toBe("381/1250"));
  it("an answer as a fraction", () => expect(ev("1 ft in yd", { format: "fraction" })).toBe("1/3 yd"));
  it("is quick", () => {
    evaluateUnits("1 km in mi");
    const t = performance.now();
    for (let i = 0; i < 2000; i++) evaluateUnits(`${i} km in mi`);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
