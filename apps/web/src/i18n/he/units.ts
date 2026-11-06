// Unit names in Hebrew, keyed by @calc/core unit ids (units.ts); currencies are named by Intl.DisplayNames instead.
// Loan words for digital units are written as Israelis write them ("קילובייט", "מגה-ביט לשנייה"), without a plural.
export const HE_UNITS: Record<string, string> = {
  // angle
  degree: "מעלות", dms: "מעלות, דקות, שניות", radian: "רדיאנים", gradian: "גראדים", turn: "סיבובים",
  arcminute: "דקות קשת", arcsecond: "שניות קשת", milliradian: "מילירדיאנים",
  // length
  parsec: "פרסקים", lightyear: "שנות אור", au: "יחידות אסטרונומיות", rack: "יחידות מסד", nmi: "מיילים ימיים", mile: "מיילים",
  km: "קילומטרים", cable: "כבלים ימיים", fathom: "פאתומים", meter: "מטרים", yard: "יארדים", foot: "רגל", inch: "אינץ'",
  cm: "סנטימטרים", mm: "מילימטרים", um: "מיקרומטרים", nm: "ננומטרים", point: "נקודות דפוס", dm: "דצימטרים",
  furlong: "פרלונגים", chain: "צ'יינים", mil: "אלפיות אינץ' (מיל)", angstrom: "אנגסטרמים",
  // area
  hectare: "הקטרים", acre: "אייקרים", sqmi: "מיילים רבועים", sqft: "רגל רבועה", sqkm: "קילומטרים רבועים", sqm: "מטרים רבועים",
  sqcm: "סנטימטרים רבועים", sqmm: "מילימטרים רבועים", are: "ארים", sqyd: "יארדים רבועים", sqin: "אינץ' רבועים",
  // volume
  m3: "מטרים מעוקבים", impgal: "גלונים בריטיים", usgal: "גלונים אמריקאיים", liter: "ליטרים", usqt: "קווארטים אמריקאיים",
  imppt: "פיינטים בריטיים", uspt: "פיינטים אמריקאיים", cup: "כוסות מטריות", ml: "מיליליטרים", ul: "מיקרוליטרים",
  cl: "סנטיליטרים", dl: "דציליטרים", impqt: "קווארטים בריטיים", impfloz: "אונקיות נוזל בריטיות", uscup: "כוסות אמריקאיות",
  usfloz: "אונקיות נוזל אמריקאיות", ustbsp: "כפות אמריקאיות", ustsp: "כפיות אמריקאיות", tbsp: "כפות מטריות",
  tsp: "כפיות מטריות", in3: "אינץ' מעוקבים", ft3: "רגל מעוקבת", yd3: "יארדים מעוקבים", barrel: "חביות (נפט)",
  // weight
  tonne: "טונות", kg: "קילוגרמים", pound: "ליברות", ounce: "אונקיות", troyoz: "אונקיות טרוי", gram: "גרמים",
  mg: "מיליגרמים", ug: "מיקרוגרמים", stone: "סטון", carat: "קראטים", grain: "גריינים",
  shortton: "טונות קצרים (ארה\"ב)", longton: "טונות ארוכים (בריטניה)",
  // duration
  century: "מאות שנים", decade: "עשורים", year: "שנים", month: "חודשים", week: "שבועות", day: "ימים", hour: "שעות",
  minute: "דקות", second: "שניות", ms: "מילישניות", us: "מיקרושניות", ns: "ננושניות",
  // temperature
  celsius: "מעלות צלזיוס", fahrenheit: "מעלות פרנהייט", kelvin: "קלווין", rankine: "מעלות רנקין",
  // digital storage
  bit: "ביט", nibble: "ניבל", byte: "בייט",
  kilobit: "קילוביט", kilobyte: "קילובייט", kibibit: "קיביביט", kibibyte: "קיביבייט",
  megabit: "מגה-ביט", megabyte: "מגה-בייט", mebibit: "מביביט", mebibyte: "מביבייט",
  gigabit: "ג'יגה-ביט", gigabyte: "ג'יגה-בייט", gibibit: "גיביביט", gibibyte: "גיביבייט",
  terabit: "טרה-ביט", terabyte: "טרה-בייט", tebibit: "טביביט", tebibyte: "טביבייט",
  petabit: "פטה-ביט", petabyte: "פטה-בייט", pebibit: "פביביט", pebibyte: "פביבייט",
  exabit: "אקסה-ביט", exabyte: "אקסה-בייט", exbibit: "אקסביביט", exbibyte: "אקסביבייט",
  zettabit: "זטה-ביט", zettabyte: "זטה-בייט", zebibit: "זביביט", zebibyte: "זביבייט",
  yottabit: "יוטה-ביט", yottabyte: "יוטה-בייט", yobibit: "יוביביט", yobibyte: "יוביבייט",
  // speed
  kmh: "קילומטרים לשעה", mph: "מיילים לשעה", mps: "מטרים לשנייה", fps: "רגל לשנייה", knot: "קשרים", kps: "קילומטרים לשנייה",
  // frequency
  hz: "הרץ", khz: "קילו-הרץ", mhz: "מגה-הרץ", ghz: "ג'יגה-הרץ", thz: "טרה-הרץ", rpm: "סיבובים לדקה",
  // energy
  joule: "ג'אול", kj: "קילו-ג'אול", mj: "מגה-ג'אול", kwh: "קילו-וואט שעה", btu: "יחידות חום בריטיות", cal: "קלוריות",
  kcal: "קילוקלוריות", erg: "ארג", ev: "אלקטרון-וולט", ftlb: "רגל-ליברה", wh: "וואט שעה", mwh: "מגה-וואט שעה",
  gj: "ג'יגה-ג'אול", therm: "תרם (ארה\"ב)",
  // pressure
  pa: "פסקל", kpa: "קילו-פסקל", hpa: "הקטו-פסקל", bar: "בר", atm: "אטמוספרות תקניות", mmhg: "מילימטרים כספית",
  inhg: "אינץ' כספית", psi: "ליברות לאינץ' רבוע", mbar: "מיליבר", mpa: "מגה-פסקל", torr: "טור",
  kgfcm2: "קילוגרם-כוח לסנטימטר רבוע",
  // power
  w: "וואט", mw: "מיליוואט", kw: "קילו-וואט", megaw: "מגה-וואט", gw: "ג'יגה-וואט", hp: "כוח סוס", ps: "כוח סוס מטרי",
  btuh: "BTU לשעה", kcalh: "קילוקלוריות לשעה", ftlbs: "רגל-ליברה לשנייה", tr: "טונות קירור",
  // force
  n: "ניוטון", kn: "קילו-ניוטון", dyn: "דיין", kgf: "קילוגרם-כוח", lbf: "ליברה-כוח", pdl: "פאונדל",
  // fuel economy
  l100km: "ליטרים ל-100 קילומטר", kml: "קילומטרים לליטר", mpgus: "מיילים לגלון (ארה\"ב)", mpguk: "מיילים לגלון (בריטניה)",
  // data rate
  bps: "ביט לשנייה", Bps: "בייט לשנייה", kbps: "קילוביט לשנייה", kBps: "קילובייט לשנייה", KiBps: "קיביבייט לשנייה",
  Mbps: "מגה-ביט לשנייה", MBps: "מגה-בייט לשנייה", MiBps: "מביבייט לשנייה",
  Gbps: "ג'יגה-ביט לשנייה", GBps: "ג'יגה-בייט לשנייה", GiBps: "גיביבייט לשנייה",
  Tbps: "טרה-ביט לשנייה", TBps: "טרה-בייט לשנייה", TiBps: "טביבייט לשנייה",
};
