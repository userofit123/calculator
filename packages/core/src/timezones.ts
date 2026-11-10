// Time zones: a date and time on the clock in one zone, and the same moment on the clock in another. The zone rules
// (offsets, daylight-saving changes, past rule changes) come from the platform's own time-zone data through Intl, so
// nothing is downloaded and the answer is right offline. A moment is kept as milliseconds since 1970 (UTC); a clock
// reading is a plain calendar date and a time of day, as dates.ts keeps them.
import { formatIsoDate, isValidDate, parseDate, type YMD } from "./dates";

export interface ZonedTime { date: YMD; hour: number; minute: number }
export interface ZoneResult {
  /** the moment, in milliseconds since 1970-01-01 UTC */
  utc: number;
  /** the clock reading in the "to" zone */
  to: ZonedTime;
  /** each zone's offset from UTC at that moment, in minutes (east is positive) */
  fromOffset: number;
  toOffset: number;
  /** the "to" zone's offset less the "from" zone's, in minutes, and what that makes the "to" clock */
  difference: number;
  relation: "ahead" | "behind" | "same";
  /** the "to" date less the "from" date: -1, 0 or 1, or ±2 across the date line (Kiritimati, UTC+14, and Pago Pago
   *  or Niue, UTC-11: 00:30 on 1 March in Kiritimati is 23:30 on 27 February in Pago Pago) */
  dayShift: number;
  /** the time typed doesn't exist in the "from" zone (the clocks went forward over it): read with the offset from
   *  before the change, so 02:30 on a night the clocks go from 02:00 to 03:00 is 03:30, as a wall clock would show */
  skipped?: ZonedTime;
  /** the time typed happens twice in the "from" zone (the clocks went back over it): the first one is used */
  twice?: boolean;
}
/** the date and time are right, but the same moment falls before year 1 or after year 9999 on one of the clocks */
export interface ZoneOutOfRange { outOfRange: true }

const MINUTE = 60_000, DAY = 86_400_000;
// one formatter per zone: making them is the slow part
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    // h23, not hour12: false, which some engines show as "24" at midnight
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", era: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    formatters.set(zone, f);
  }
  return f;
}

/** true when the platform knows the zone ("Europe/Paris", "UTC") */
export function isTimeZone(zone: string): boolean {
  if (!zone) return false;
  try { formatter(zone); return true; } catch { return false; }
}

/** milliseconds since 1970 for a clock reading taken as UTC (setUTCFullYear, so years below 100 aren't read as 19xx) */
function wallMs(v: YMD, hour: number, minute: number, second = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(v.y, v.m - 1, v.d);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

/** the clock reading in a zone at a moment, to the second */
function partsAt(zone: string, utc: number): ZonedTime & { second: number } {
  const p: Record<string, string> = {};
  for (const x of formatter(zone).formatToParts(new Date(utc))) p[x.type] = x.value;
  const year = Number(p.year);
  return { date: { y: p.era === "BC" || p.era === "B" ? 1 - year : year, m: Number(p.month), d: Number(p.day) }, hour: Number(p.hour) % 24, minute: Number(p.minute), second: Number(p.second) };
}

/** a zone's offset from UTC at a moment, in milliseconds (some old local mean times have seconds in them) */
function offsetMs(zone: string, utc: number): number {
  const r = partsAt(zone, utc);
  return wallMs(r.date, r.hour, r.minute, r.second) - Math.floor(utc / 1000) * 1000;
}

/** a zone's offset from UTC at a moment, in whole minutes (east is positive) */
export function zoneOffset(zone: string, utc: number): number {
  return Math.round(offsetMs(zone, utc) / MINUTE);
}

/** the clock reading in a zone at a moment */
export function zonedTime(zone: string, utc: number): ZonedTime {
  const { date, hour, minute } = partsAt(zone, utc);
  return { date, hour, minute };
}

/** the moment a clock in the zone shows that date and time: a skipped time (clocks forward) reads with the offset from
 *  before the change, a time that comes twice (clocks back) is the first one */
export function zonedToUtc(zone: string, date: YMD, hour: number, minute: number): { utc: number; skipped: boolean; twice: boolean } {
  const wall = wallMs(date, hour, minute);
  // a day either side is clear of any change near the time; zones change at most once a day
  const before = offsetMs(zone, wall - DAY), after = offsetMs(zone, wall + DAY);
  const fits = [before, after].filter((o, i, a) => a.indexOf(o) === i && offsetMs(zone, wall - o) === o);
  // the first of two is the earlier moment, the one with the larger offset
  if (fits.length) return { utc: wall - Math.max(...fits), skipped: false, twice: fits.length > 1 };
  return { utc: wall - before, skipped: true, twice: false };
}

/** "09:05" */
export const formatClock = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
/** "09:05" (what a time field gives) to hours and minutes, or null */
export function parseClock(s: string): { hour: number; minute: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$/.exec(s);
  if (!m) return null;
  const hour = +m[1]!, minute = +m[2]!;
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** "2026-11-10" and "09:30" on the clock in `from` to the same moment in `to`; null when the date, time or a zone is
 *  not right, outOfRange when the moment is past the years 1 to 9999 there (dates.ts keeps to those years) */
export function convertZoned(date: string, time: string, from: string, to: string): ZoneResult | ZoneOutOfRange | null {
  const d = parseDate(date), c = parseClock(time);
  if (!d || !c || !isTimeZone(from) || !isTimeZone(to)) return null;
  const { utc, skipped, twice } = zonedToUtc(from, d, c.hour, c.minute);
  const shown = zonedTime(from, utc), out = zonedTime(to, utc);
  // a skipped time read later can step past 9999 on the from clock too
  if (!isValidDate(out.date) || !isValidDate(shown.date)) return { outOfRange: true };
  const dayShift = Math.round((wallMs(out.date, 0, 0) - wallMs(shown.date, 0, 0)) / DAY);
  const fromOffset = zoneOffset(from, utc), toOffset = zoneOffset(to, utc), difference = toOffset - fromOffset;
  const relation = difference > 0 ? "ahead" : difference < 0 ? "behind" : "same";
  return { utc, to: out, fromOffset, toOffset, difference, relation, dayShift, ...(skipped ? { skipped: shown } : {}), ...(twice ? { twice } : {}) };
}

/** "UTC", "UTC+1", "UTC-3:30", "UTC+5:45" */
export function formatOffset(minutes: number): string {
  if (!minutes) return "UTC";
  const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60;
  return `UTC${minutes < 0 ? "-" : "+"}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}
/** a difference between two offsets, in hours: "1", "5:30", "0:45" (no sign: the words say ahead or behind) */
export function formatHours(minutes: number): string {
  const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60;
  return m ? `${h}:${String(m).padStart(2, "0")}` : String(h);
}

/** every zone the platform knows, plus UTC (some engines leave it out of the list), sorted by name */
export function timeZones(): string[] {
  let all: string[] = [];
  try { all = Intl.supportedValuesOf("timeZone"); } catch { /* an older engine: the world list below */ }
  return [...new Set([...(all.length ? all : WORLD_ZONES).filter(isTimeZone), "UTC"])].sort();
}
/** this device's zone, or UTC when the platform doesn't say */
export function deviceTimeZone(): string {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (z && isTimeZone(z)) return z; } catch { /* below */ }
  return "UTC";
}
/** "America/Argentina/Buenos_Aires" to its place, "Buenos Aires", and its region, "America · Argentina" */
export function zonePlace(zone: string): { place: string; region: string } {
  const parts = zone.split("/").map((p) => p.replace(/_/g, " "));
  return { place: parts[parts.length - 1]!, region: parts.slice(0, -1).join(" · ") };
}

/** a moment's date in the from zone for a date field, "2026-11-10", and its time, "09:30" (the "Now" button) */
export function zonedFields(zone: string, utc: number): { date: string; time: string } {
  const z = zonedTime(zone, utc);
  return { date: formatIsoDate(z.date), time: formatClock(z.hour, z.minute) };
}

/** well-known places across the offsets, shown under the converter with the same moment in each */
export const WORLD_ZONES = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo",
  "UTC", "Europe/London", "Europe/Paris", "Europe/Kyiv", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Shanghai",
  "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
] as const;
