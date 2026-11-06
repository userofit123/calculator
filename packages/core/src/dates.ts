// Date and time maths on plain calendar dates (year, month, day): no clock, no time zone, so a date never moves a day
// because of where or when the app is opened. The calendar is the proleptic Gregorian one (today's rules carried back),
// for the years 1 to 9999, the range a date field can hold. Dates are counted as day numbers (days since 1970-01-01),
// so differences are whole-number sums with no daylight-saving hour to trip over.

export interface YMD { y: number; m: number; d: number }
export const MIN_YEAR = 1, MAX_YEAR = 9999;

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function daysInMonth(y: number, m: number): number {
  return m === 2 ? (isLeapYear(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
}
const inRange = (y: number) => y >= MIN_YEAR && y <= MAX_YEAR;
export const isValidDate = (v: YMD) =>
  [v.y, v.m, v.d].every(Number.isInteger) && inRange(v.y) && v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= daysInMonth(v.y, v.m);

/** "2026-11-06" (what a date field gives) to a date, or null when it isn't a real date */
export function parseDate(s: string): YMD | null {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(s);
  if (!m) return null;
  const v = { y: +m[1]!, m: +m[2]!, d: +m[3]! };
  return isValidDate(v) ? v : null;
}
const p2 = (n: number) => String(n).padStart(2, "0");
/** The date as a date field wants it: "2026-11-06" */
export const formatIsoDate = (v: YMD) => `${String(v.y).padStart(4, "0")}-${p2(v.m)}-${p2(v.d)}`;

// Days since 1970-01-01 and back (H. Hinnant's civil-date algorithms: exact integer maths, any year)
export function dayNumber({ y, m, d }: YMD): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400), yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export function fromDayNumber(n: number): YMD {
  const z = n + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** Days from a to b (negative when b is earlier) */
export const daysBetween = (a: YMD, b: YMD) => dayNumber(b) - dayNumber(a);
export const compareDates = (a: YMD, b: YMD) => Math.sign(daysBetween(b, a));
export const addDays = (v: YMD, n: number) => fromDayNumber(dayNumber(v) + n);

/** The weekday, ISO numbering: 1 = Monday ... 7 = Sunday */
export const weekday = (v: YMD) => ((((dayNumber(v) + 3) % 7) + 7) % 7) + 1;
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** 1 for 1 January */
export const dayOfYear = (v: YMD) => daysBetween({ y: v.y, m: 1, d: 1 }, v) + 1;
export const daysInYear = (y: number) => (isLeapYear(y) ? 366 : 365);
/** The ISO 8601 week: weeks start on Monday, week 1 holds the year's first Thursday (so 1 Jan can be in last year's week 52 or 53) */
export function isoWeek(v: YMD): { year: number; week: number } {
  const thursday = fromDayNumber(dayNumber(v) - weekday(v) + 4);
  return { year: thursday.y, week: Math.floor((dayOfYear(thursday) - 1) / 7) + 1 };
}

/** Adds whole months (negative to go back). A day the new month hasn't got is moved to its last day (31 Jan + 1 month
 *  is 28 or 29 Feb); `clamped` says when that happened. */
export function addMonths(v: YMD, n: number): { date: YMD; clamped: boolean } {
  const t = v.y * 12 + (v.m - 1) + n, y = Math.floor(t / 12), m = t - y * 12 + 1, last = daysInMonth(y, m);
  return { date: { y, m, d: Math.min(v.d, last) }, clamped: v.d > last };
}
export const addYears = (v: YMD, n: number) => addMonths(v, n * 12);

export interface Period { years: number; months: number; weeks: number; days: number }
export type DateResult = { date: YMD; clamped: boolean } | { error: string };
/** Adds (or with sign -1 takes away) a period: years and months first (with the month-end rule above), then weeks and days */
export function addPeriod(v: YMD, p: Partial<Period>, sign: 1 | -1 = 1): DateResult {
  const n = (x: number | undefined) => x ?? 0;
  const parts = [n(p.years), n(p.months), n(p.weeks), n(p.days)];
  if (!parts.every(Number.isInteger)) return { error: "Use whole numbers" };
  if (parts.some((x) => Math.abs(x) > 4_000_000)) return { error: "Outside the years 1 to 9999" };
  const r = addMonths(v, sign * (n(p.years) * 12 + n(p.months)));
  const date = addDays(r.date, sign * (n(p.weeks) * 7 + n(p.days)));
  if (!inRange(date.y)) return { error: "Outside the years 1 to 9999" };
  return { date, clamped: r.clamped };
}

export interface YMDiff { years: number; months: number; days: number; sign: -1 | 0 | 1 }
/** The difference as years, months and days, counted from the earlier date: whole months first, then the days left
 *  (31 Jan to 1 Mar is 1 month, 1 day; 31 Jan to 28 Feb is 28 days). The earlier date plus the result (with the
 *  month-end rule) gives the later one. */
export function diffYMD(a: YMD, b: YMD): YMDiff {
  const sign = compareDates(b, a) as -1 | 0 | 1;
  const [s, e] = sign < 0 ? [b, a] : [a, b];
  let months = (e.y - s.y) * 12 + (e.m - s.m);
  if (e.d < s.d) months--;
  // a start day the month hasn't got (31st, 29 Feb) lands on the month's last day; never go past the end
  while (months > 0 && compareDates(addMonths(s, months).date, e) > 0) months--;
  const days = daysBetween(addMonths(s, months).date, e);
  return { years: Math.floor(months / 12), months: months % 12, days, sign };
}

/** Mon-Fri days from a up to b, not counting b (the same way as the day count: Monday to the next Monday is 5), or
 *  counting both ends with includeEnd. Negative when b is earlier. */
export function businessDays(a: YMD, b: YMD, includeEnd = false): number {
  let sign = 1, s = dayNumber(a), e = dayNumber(b);
  if (e < s) { [s, e] = [e, s]; sign = -1; }
  // [s, e) or [s, e]: whole weeks give 5 each, then the days left over one by one (at most 6)
  const total = e - s + (includeEnd ? 1 : 0), weeks = Math.floor(total / 7);
  let count = weeks * 5;
  for (let i = s + weeks * 7; i < s + total; i++) if (weekday(fromDayNumber(i)) <= 5) count++;
  return sign * count;
}

export interface Age { years: number; months: number; days: number; totalDays: number; nextBirthday: YMD; daysToBirthday: number }
/** Age on a day. Someone born on 29 Feb turns a year older on 1 Mar in other years. Null when born after that day. */
export function age(birth: YMD, on: YMD): Age | null {
  if (compareDates(birth, on) > 0) return null;
  let d = diffYMD(birth, on);
  // a 29 Feb birthday is on 1 Mar in other years: that day is exactly N years, not N years and a day
  if (birth.m === 2 && birth.d === 29 && on.m === 3 && on.d === 1 && on.y > birth.y && !isLeapYear(on.y)) {
    d = { years: on.y - birth.y, months: 0, days: 0, sign: 1 };
  }
  const next = (n: number) => { const r = addYears(birth, n); return r.clamped ? addDays(r.date, 1) : r.date; };
  let nb = next(d.years);
  if (compareDates(nb, on) <= 0) nb = next(d.years + 1);
  return { years: d.years, months: d.months, days: d.days, totalDays: daysBetween(birth, on), nextBirthday: nb, daysToBirthday: daysBetween(on, nb) };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** "2 years, 3 months, 4 days" (parts that are 0 left out; "0 days" when all are) */
export function describeYMD(v: Pick<YMDiff, "years" | "months" | "days">): string {
  const parts: string[] = [];
  if (v.years) parts.push(plural(v.years, "year"));
  if (v.months) parts.push(plural(v.months, "month"));
  if (v.days || !parts.length) parts.push(plural(v.days, "day"));
  return parts.join(", ");
}
/** 23 days as "3 weeks, 2 days" (always from a non-negative count) */
export function describeWeeks(days: number): string {
  const n = Math.abs(days), w = Math.floor(n / 7), d = n % 7;
  return w ? (d ? `${plural(w, "week")}, ${plural(d, "day")}` : plural(w, "week")) : plural(d, "day");
}
export const describeDays = (n: number) => plural(n, "day");

// Times and durations, in whole seconds

/** "1:30", "1:30:15", "-0:45", "2" (hours), "90m"-style isn't taken. Minutes and seconds after a colon are 0-59. */
export function parseDuration(s: string): number | { error: string } | null {
  const t = s.trim().replace(/^[−–]/, "-");
  if (!t) return null;
  const m = /^([+-]?)(\d+)(?::(\d{1,2}))?(?::(\d{1,2}))?$/.exec(t);
  if (!m) return { error: "Type hours:minutes, like 1:30" };
  const mi = m[3] ? +m[3] : 0, se = m[4] ? +m[4] : 0;
  if (mi > 59 || se > 59) return { error: "Minutes and seconds go up to 59" };
  if (m[2]!.length > 7) return { error: "Too long" };
  const v = +m[2]! * 3600 + mi * 60 + se;
  return m[1] === "-" ? -v : v;
}
/** A time of day, "09:30" or "9:30:15" (0:00 to 24:00), in seconds since midnight */
export function parseTime(s: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) return null;
  const h = +m[1]!, mi = +m[2]!, se = m[3] ? +m[3] : 0;
  if (mi > 59 || se > 59 || h > 24 || (h === 24 && (mi || se))) return null;
  return h * 3600 + mi * 60 + se;
}
/** Seconds as "h:mm" or "h:mm:ss" (seconds shown when there are any, or when asked), "-" before a negative one */
export function formatDuration(sec: number, withSeconds = false): string {
  const n = Math.abs(Math.round(sec)), h = Math.floor(n / 3600), mi = Math.floor((n % 3600) / 60), se = n % 60;
  return `${sec < 0 ? "-" : ""}${h}:${p2(mi)}${withSeconds || se ? `:${p2(se)}` : ""}`;
}
/** "1 day, 2 hours, 5 minutes" for a duration (parts that are 0 left out) */
export function describeDuration(sec: number): string {
  const n = Math.abs(Math.round(sec)), d = Math.floor(n / 86400), h = Math.floor((n % 86400) / 3600), mi = Math.floor((n % 3600) / 60), se = n % 60;
  const parts = [[d, "day"], [h, "hour"], [mi, "minute"], [se, "second"]].filter(([v]) => v).map(([v, w]) => plural(v as number, w as string));
  return (sec < 0 ? "minus " : "") + (parts.length ? parts.join(", ") : "0 minutes");
}
/** From one time of day to another; an end before the start is taken as the next day */
export function timeBetween(start: number, end: number): { seconds: number; nextDay: boolean } {
  return end >= start ? { seconds: end - start, nextDay: false } : { seconds: end + 86400 - start, nextDay: true };
}
/** A time of day plus a duration: the time it lands on, and how many days later (or earlier, negative) */
export function addToTime(time: number, dur: number): { time: number; dayOffset: number } {
  const t = time + dur, dayOffset = Math.floor(t / 86400);
  return { time: t - dayOffset * 86400, dayOffset };
}
/** "1:30 + 2:45 - 0:20": durations added and taken away, in seconds; null when empty */
export function sumDurations(s: string): number | { error: string } | null {
  const t = s.replace(/[−–]/g, "-").trim();
  if (!t) return null;
  let total = 0, rest = t, first = true;
  while (rest) {
    const m = /^([+-]?)\s*([^\s+-]+)\s*/.exec(rest);
    if (!m || (!first && !m[1])) return { error: "Put + or - between the times" };
    const v = parseDuration(m[2]!);
    if (v === null || typeof v === "object") return v ?? { error: "Type hours:minutes, like 1:30" };
    total += m[1] === "-" ? -v : v;
    rest = rest.slice(m[0].length); first = false;
  }
  return total;
}
