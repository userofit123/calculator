// The converter's units: every category and unit of GNOME's calculator, plus a few common ones it lacks (marked
// "added" below). Each unit is defined by how many of its category's base unit it is (factor, written as an expression
// so that defined values stay exact: an inch is 0.0254 m exactly, a pound 0.45359237 kg exactly); temperatures also
// have an offset (kelvin = (x + offset) × factor), fuel economy in litres per 100 km is the inverse of km per litre.
// Only units defined through π (radian, parsec) are not exact.

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  /** base units per unit, as an expression ("0.0254", "5/9", "180/pi") */
  factor: string;
  /** added before scaling: base = (x + offset) × factor (temperatures) */
  offset?: string;
  /** base = factor ÷ x (litres per 100 km) */
  inverse?: boolean;
  /** shown as degrees, minutes and seconds */
  dms?: boolean;
  /** other names and abbreviations to find it by */
  alias?: string;
  /** a hint shown next to the name (a currency's fixed rate) */
  hint?: string;
}
export interface Category { id: string; name: string; units: Unit[]; base: string }

type Row = [id: string, name: string, symbol: string, factor: string, more?: Partial<Unit>];
const units = (rows: Row[]): Unit[] => rows.map(([id, name, symbol, factor, more]) => ({ id, name, symbol, factor, ...more }));

const LB = "0.45359237", G0 = "9.80665", BTU = "1055.05585262", MMHG = "133.322387415";

// Digital storage in bytes and data rates in bits per second: the decimal (kilo = 1000) and binary (kibi = 1024)
// prefixes, in bits and in bytes, as GNOME lists them
const PREFIXES: [string, string, string, string][] = [
  ["kilo", "kibi", "k", "Ki"], ["mega", "mebi", "M", "Mi"], ["giga", "gibi", "G", "Gi"], ["tera", "tebi", "T", "Ti"],
  ["peta", "pebi", "P", "Pi"], ["exa", "exbi", "E", "Ei"], ["zetta", "zebi", "Z", "Zi"], ["yotta", "yobi", "Y", "Yi"],
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
function storage(): Row[] {
  const rows: Row[] = [["bit", "Bits", "b", "1/8"], ["nibble", "Nibbles", "nibble", "1/2"], ["byte", "Bytes", "B", "1"]];
  PREFIXES.forEach(([dec, bin, ds, bs], i) => {
    const k = i + 1;
    rows.push(
      [`${dec}bit`, `${cap(dec)}bits`, `${ds}b`, `1000^${k}/8`], [`${dec}byte`, `${cap(dec)}bytes`, `${ds === "k" ? "kB" : ds + "B"}`, `1000^${k}`],
      [`${bin}bit`, `${cap(bin)}bits`, `${bs}b`, `1024^${k}/8`], [`${bin}byte`, `${cap(bin)}bytes`, `${bs}B`, `1024^${k}`],
    );
  });
  return rows;
}
function dataRate(): Row[] {
  const rows: Row[] = [["bps", "Bits per second", "bit/s", "1", { alias: "bps" }], ["Bps", "Bytes per second", "B/s", "8"]];
  PREFIXES.slice(0, 4).forEach(([dec, bin, ds, bs], i) => {
    const k = i + 1;
    rows.push(
      [`${ds}bps`, `${cap(dec)}bits per second`, `${ds}bit/s`, `1000^${k}`, { alias: `${ds}bps` }],
      [`${ds}Bps`, `${cap(dec)}bytes per second`, `${ds}B/s`, `8*1000^${k}`],
      [`${bs}Bps`, `${cap(bin)}bytes per second`, `${bs}B/s`, `8*1024^${k}`],
    );
  });
  return rows;
}

// built inside a function marked pure, so a bundle that never uses the converter (the first screen) leaves it all out
export const UNIT_CATEGORIES: Category[] = /* @__PURE__ */ (() => [
  { id: "angle", name: "Angle", base: "degree", units: units([
    ["degree", "Degrees", "°", "1", { alias: "deg decimal" }],
    ["dms", "Degrees, minutes, seconds", "° ′ ″", "1", { dms: true, alias: "dms" }],
    ["radian", "Radians", "rad", "180/pi"],
    ["gradian", "Gradians", "grad", "9/10", { alias: "gon" }],
    // added
    ["turn", "Turns", "tr", "360", { alias: "revolution" }],
    ["arcminute", "Minutes of arc", "′", "1/60", { alias: "arcmin" }],
    ["arcsecond", "Seconds of arc", "″", "1/3600", { alias: "arcsec" }],
    ["milliradian", "Milliradians", "mrad", "0.18/pi", { alias: "mil" }],
  ]) },
  { id: "length", name: "Length", base: "meter", units: units([
    ["parsec", "Parsecs", "pc", "648000/pi*149597870700"],
    ["lightyear", "Light years", "ly", "9460730472580800"],
    ["au", "Astronomical units", "au", "149597870700"],
    ["rack", "Rack units", "U", "0.04445"],
    ["nmi", "Nautical miles", "nmi", "1852"],
    ["mile", "Miles", "mi", "1609.344"],
    ["km", "Kilometers", "km", "1000", { alias: "kilometres" }],
    ["cable", "Cables", "cb", "219.456"],
    ["fathom", "Fathoms", "ftm", "1.8288"],
    ["meter", "Meters", "m", "1", { alias: "metres" }],
    ["yard", "Yards", "yd", "0.9144"],
    ["foot", "Feet", "ft", "0.3048"],
    ["inch", "Inches", "in", "0.0254"],
    ["cm", "Centimeters", "cm", "1/100", { alias: "centimetres" }],
    ["mm", "Millimeters", "mm", "1/1000", { alias: "millimetres" }],
    ["um", "Micrometers", "µm", "10^-6", { alias: "um micron" }],
    ["nm", "Nanometers", "nm", "10^-9"],
    ["point", "Desktop publishing points", "pt", "0.0254/72"],
    // added
    ["dm", "Decimeters", "dm", "1/10"],
    ["furlong", "Furlongs", "fur", "201.168"],
    ["chain", "Chains", "ch", "20.1168"],
    ["mil", "Thou (mils)", "mil", "0.0000254", { alias: "thou" }],
    ["angstrom", "Ångströms", "Å", "10^-10", { alias: "angstrom" }],
  ]) },
  { id: "area", name: "Area", base: "square meter", units: units([
    ["hectare", "Hectares", "ha", "10000"],
    ["acre", "Acres", "ac", "4046.8564224"],
    ["sqmi", "Square miles", "mi²", "1609.344^2"],
    ["sqft", "Square feet", "ft²", "0.3048^2"],
    ["sqkm", "Square kilometers", "km²", "10^6"],
    ["sqm", "Square meters", "m²", "1"],
    ["sqcm", "Square centimeters", "cm²", "10^-4"],
    ["sqmm", "Square millimeters", "mm²", "10^-6"],
    // added
    ["are", "Ares", "a", "100"],
    ["sqyd", "Square yards", "yd²", "0.9144^2"],
    ["sqin", "Square inches", "in²", "0.0254^2"],
  ]) },
  { id: "volume", name: "Volume", base: "liter", units: units([
    ["m3", "Cubic meters", "m³", "1000"],
    ["impgal", "British gallons", "gal (UK)", "4.54609", { alias: "imperial gallon" }],
    ["usgal", "US gallons", "gal (US)", "3.785411784"],
    ["liter", "Liters", "L", "1", { alias: "litres" }],
    ["usqt", "US quarts", "qt (US)", "3.785411784/4"],
    ["imppt", "British pints", "pt (UK)", "0.56826125", { alias: "imperial pint" }],
    ["uspt", "US pints", "pt (US)", "3.785411784/8"],
    ["cup", "Metric cups", "cup", "1/4"],
    ["ml", "Milliliters", "mL", "1/1000", { alias: "cm3 cc millilitres" }],
    ["ul", "Microliters", "µL", "10^-6", { alias: "ul" }],
    // added
    ["cl", "Centiliters", "cL", "1/100"],
    ["dl", "Deciliters", "dL", "1/10"],
    ["impqt", "British quarts", "qt (UK)", "4.54609/4"],
    ["impfloz", "British fluid ounces", "fl oz (UK)", "4.54609/160"],
    ["uscup", "US cups", "cup (US)", "3.785411784/16"],
    ["usfloz", "US fluid ounces", "fl oz (US)", "3.785411784/128"],
    ["ustbsp", "US tablespoons", "tbsp (US)", "3.785411784/256"],
    ["ustsp", "US teaspoons", "tsp (US)", "3.785411784/768"],
    ["tbsp", "Metric tablespoons", "tbsp", "0.015", { alias: "tablespoon" }],
    ["tsp", "Metric teaspoons", "tsp", "0.005", { alias: "teaspoon" }],
    ["in3", "Cubic inches", "in³", "0.254^3"],
    ["ft3", "Cubic feet", "ft³", "3.048^3"],
    ["yd3", "Cubic yards", "yd³", "9.144^3"],
    ["barrel", "Barrels (oil)", "bbl", "3.785411784*42"],
  ]) },
  { id: "mass", name: "Weight", base: "kilogram", units: units([
    ["tonne", "Tonnes", "t", "1000", { alias: "metric ton" }],
    ["kg", "Kilograms", "kg", "1"],
    ["pound", "Pounds", "lb", LB],
    ["ounce", "Ounces", "oz", `${LB}/16`],
    ["troyoz", "Troy ounces", "ozt", "0.0311034768"],
    ["gram", "Grams", "g", "1/1000"],
    ["mg", "Milligrams", "mg", "10^-6"],
    ["ug", "Micrograms", "µg", "10^-9", { alias: "ug mcg" }],
    ["stone", "Stone", "st", `14*${LB}`],
    // added
    ["carat", "Carats", "ct", "0.0002"],
    ["grain", "Grains", "gr", "0.00006479891"],
    ["shortton", "Short tons (US)", "ton (US)", `2000*${LB}`],
    ["longton", "Long tons (UK)", "ton (UK)", `2240*${LB}`],
  ]) },
  { id: "duration", name: "Duration", base: "second", units: units([
    ["century", "Centuries", "c", "3155760000"],
    ["decade", "Decades", "dec", "315576000"],
    ["year", "Years", "y", "31557600", { alias: "yr" }],
    ["month", "Months", "mo", "2629800"],
    ["week", "Weeks", "wk", "604800"],
    ["day", "Days", "d", "86400"],
    ["hour", "Hours", "h", "3600", { alias: "hr" }],
    ["minute", "Minutes", "min", "60"],
    ["second", "Seconds", "s", "1", { alias: "sec" }],
    ["ms", "Milliseconds", "ms", "10^-3"],
    ["us", "Microseconds", "µs", "10^-6", { alias: "us" }],
    ["ns", "Nanoseconds", "ns", "10^-9"],
  ]) },
  { id: "temperature", name: "Temperature", base: "kelvin", units: units([
    ["celsius", "Celsius", "°C", "1", { offset: "273.15", alias: "centigrade" }],
    ["fahrenheit", "Fahrenheit", "°F", "5/9", { offset: "459.67" }],
    ["kelvin", "Kelvin", "K", "1"],
    ["rankine", "Rankine", "°R", "5/9"],
  ]) },
  { id: "storage", name: "Digital storage", base: "byte", units: units(storage()) },
  { id: "speed", name: "Speed", base: "meter per second", units: units([
    ["kmh", "Kilometers per hour", "km/h", "1000/3600", { alias: "kph" }],
    ["mph", "Miles per hour", "mph", "1609.344/3600"],
    ["mps", "Meters per second", "m/s", "1"],
    ["fps", "Feet per second", "ft/s", "0.3048"],
    ["knot", "Knots", "kn", "1852/3600"],
    // added
    ["kps", "Kilometers per second", "km/s", "1000"],
  ]) },
  { id: "frequency", name: "Frequency", base: "hertz", units: units([
    ["hz", "Hertz", "Hz", "1"],
    ["khz", "Kilohertz", "kHz", "10^3"],
    ["mhz", "Megahertz", "MHz", "10^6"],
    ["ghz", "Gigahertz", "GHz", "10^9"],
    ["thz", "Terahertz", "THz", "10^12"],
    // added
    ["rpm", "Revolutions per minute", "rpm", "1/60"],
  ]) },
  { id: "energy", name: "Energy", base: "joule", units: units([
    ["joule", "Joules", "J", "1"],
    ["kj", "Kilojoules", "kJ", "10^3"],
    ["mj", "Megajoules", "MJ", "10^6"],
    ["kwh", "Kilowatt-hours", "kWh", "3600000"],
    ["btu", "British thermal units", "BTU", BTU],
    ["cal", "Calories", "cal", "4.184"],
    ["kcal", "Kilocalories", "kcal", "4184"],
    ["erg", "Ergs", "erg", "10^-7"],
    ["ev", "Electron volts", "eV", "1.602176634*10^-19"],
    ["ftlb", "Foot-pounds", "ft·lbf", `0.3048*${G0}*${LB}`],
    // added
    ["wh", "Watt-hours", "Wh", "3600"],
    ["mwh", "Megawatt-hours", "MWh", "3600000000"],
    ["gj", "Gigajoules", "GJ", "10^9"],
    ["therm", "Therms (US)", "thm", "105480400"],
  ]) },
  { id: "pressure", name: "Pressure", base: "pascal", units: units([
    ["pa", "Pascals", "Pa", "1"],
    ["kpa", "Kilopascals", "kPa", "1000"],
    ["hpa", "Hectopascals", "hPa", "100"],
    ["bar", "Bars", "bar", "100000"],
    ["atm", "Standard atmospheres", "atm", "101325"],
    ["mmhg", "Millimeters of mercury", "mmHg", MMHG],
    ["inhg", "Inches of mercury", "inHg", `${MMHG}*25.4`],
    ["psi", "Pounds per square inch", "psi", `${LB}*${G0}/0.0254^2`],
    // added
    ["mbar", "Millibars", "mbar", "100"],
    ["mpa", "Megapascals", "MPa", "10^6"],
    ["torr", "Torr", "Torr", "101325/760"],
    ["kgfcm2", "Kilograms-force per square centimeter", "kgf/cm²", `${G0}*10^4`, { alias: "at" }],
  ]) },
  // added: categories GNOME's calculator doesn't have
  { id: "power", name: "Power", base: "watt", units: units([
    ["w", "Watts", "W", "1"],
    ["mw", "Milliwatts", "mW", "10^-3"],
    ["kw", "Kilowatts", "kW", "10^3"],
    ["megaw", "Megawatts", "MW", "10^6"],
    ["gw", "Gigawatts", "GW", "10^9"],
    ["hp", "Horsepower", "hp", `550*0.3048*${G0}*${LB}`, { alias: "mechanical" }],
    ["ps", "Metric horsepower", "PS", `75*${G0}`, { alias: "cv pk" }],
    ["btuh", "BTU per hour", "BTU/h", `${BTU}/3600`],
    ["kcalh", "Kilocalories per hour", "kcal/h", "4184/3600"],
    ["ftlbs", "Foot-pounds per second", "ft·lbf/s", `0.3048*${G0}*${LB}`],
    ["tr", "Tons of refrigeration", "TR", `12000*${BTU}/3600`],
  ]) },
  { id: "force", name: "Force", base: "newton", units: units([
    ["n", "Newtons", "N", "1"],
    ["kn", "Kilonewtons", "kN", "1000"],
    ["dyn", "Dynes", "dyn", "10^-5"],
    ["kgf", "Kilograms-force", "kgf", G0, { alias: "kilopond" }],
    ["lbf", "Pounds-force", "lbf", `${LB}*${G0}`],
    ["pdl", "Poundals", "pdl", `${LB}*0.3048`],
  ]) },
  { id: "fuel", name: "Fuel economy", base: "kilometer per liter", units: units([
    ["l100km", "Liters per 100 kilometers", "L/100 km", "100", { inverse: true }],
    ["kml", "Kilometers per liter", "km/L", "1"],
    ["mpgus", "Miles per gallon (US)", "mpg (US)", "1.609344/3.785411784"],
    ["mpguk", "Miles per gallon (UK)", "mpg (UK)", "1.609344/4.54609"],
  ]) },
  { id: "datarate", name: "Data rate", base: "bit per second", units: units(dataRate()) },
])();
