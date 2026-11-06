import { describe, expect, it } from "vitest";
import {
  parseDate, formatIsoDate, isLeapYear, daysInMonth, dayNumber, fromDayNumber, daysBetween, addDays, addMonths, addYears, addPeriod, diffYMD,
  businessDays, WEEKEND_SAT_SUN, WEEKEND_FRI_SAT, weekday, dayOfYear, isoWeek, age, describeYMD, describeWeeks, parseDuration, parseTime, formatDuration, describeDuration,
  timeBetween, addToTime, sumDurations, type YMD,
} from "../src";

const D = (s: string): YMD => { const v = parseDate(s); if (!v) throw new Error("bad date " + s); return v; };
const iso = (r: { date: YMD } | { error: string }) => ("date" in r ? formatIsoDate(r.date) : "error: " + r.error);

describe("parse and format", () => {
  it("reads a date field's value", () => expect(D("2026-11-06")).toEqual({ y: 2026, m: 11, d: 6 }));
  it("refuses dates that don't exist", () => {
    expect(parseDate("2026-02-29")).toBeNull();
    expect(parseDate("2026-04-31")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("0000-01-01")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("6/11/2026")).toBeNull();
  });
  it("takes 29 Feb in a leap year", () => expect(parseDate("2024-02-29")).not.toBeNull());
  it("formats with zero padding", () => expect(formatIsoDate({ y: 5, m: 3, d: 7 })).toBe("0005-03-07"));
});

describe("calendar", () => {
  it("leap years", () => {
    expect([2024, 2000, 1600].map(isLeapYear)).toEqual([true, true, true]);
    expect([2023, 1900, 2100].map(isLeapYear)).toEqual([false, false, false]);
  });
  it("days in month", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2023, 4)).toBe(30);
    expect(daysInMonth(2023, 12)).toBe(31);
  });
  it("day numbers start at 1970-01-01", () => {
    expect(dayNumber(D("1970-01-01"))).toBe(0);
    expect(dayNumber(D("2000-03-01"))).toBe(11017);
    expect(dayNumber(D("1969-12-31"))).toBe(-1);
  });
  it("day numbers round-trip over the whole range", () => {
    for (const s of ["0001-01-01", "1582-10-15", "1900-02-28", "2024-02-29", "9999-12-31"]) expect(formatIsoDate(fromDayNumber(dayNumber(D(s))))).toBe(s);
    for (let n = -800000; n < 3000000; n += 9973) expect(dayNumber(fromDayNumber(n))).toBe(n);
  });
  it("weekdays", () => {
    expect(weekday(D("1970-01-01"))).toBe(4); // Thursday
    expect(weekday(D("2026-11-06"))).toBe(5); // Friday
    expect(weekday(D("2000-01-01"))).toBe(6); // Saturday
    expect(weekday(D("0001-01-01"))).toBe(1); // proleptic Gregorian Monday
    expect(weekday(D("1969-12-28"))).toBe(7); // Sunday before day 0
  });
  it("day of year", () => {
    expect(dayOfYear(D("2026-01-01"))).toBe(1);
    expect(dayOfYear(D("2024-12-31"))).toBe(366);
    expect(dayOfYear(D("2023-12-31"))).toBe(365);
    expect(dayOfYear(D("2024-03-01"))).toBe(61);
  });
  it("ISO week numbers", () => {
    expect(isoWeek(D("2026-11-06"))).toEqual({ year: 2026, week: 45 });
    expect(isoWeek(D("2021-01-01"))).toEqual({ year: 2020, week: 53 });
    expect(isoWeek(D("2024-12-30"))).toEqual({ year: 2025, week: 1 });
    expect(isoWeek(D("2026-01-01"))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(D("2027-01-03"))).toEqual({ year: 2026, week: 53 });
  });
});

describe("days between", () => {
  it("counts days", () => {
    expect(daysBetween(D("2026-01-01"), D("2026-12-31"))).toBe(364);
    expect(daysBetween(D("2024-01-01"), D("2025-01-01"))).toBe(366);
    expect(daysBetween(D("2026-11-06"), D("2026-11-06"))).toBe(0);
  });
  it("is negative backwards", () => expect(daysBetween(D("2026-03-10"), D("2026-03-01"))).toBe(-9));
  it("has no daylight-saving gaps (late March, late October)", () => {
    expect(daysBetween(D("2026-03-28"), D("2026-03-30"))).toBe(2);
    expect(daysBetween(D("2026-10-24"), D("2026-10-26"))).toBe(2);
  });
  it("across centuries", () => expect(daysBetween(D("1900-01-01"), D("2000-01-01"))).toBe(36524));
});

describe("adding", () => {
  it("days and weeks", () => {
    expect(formatIsoDate(addDays(D("2026-12-25"), 10))).toBe("2027-01-04");
    expect(iso(addPeriod(D("2026-11-06"), { weeks: 2 }))).toBe("2026-11-20");
    expect(iso(addPeriod(D("2026-03-01"), { days: 1 }, -1))).toBe("2026-02-28");
  });
  it("months with the month-end rule", () => {
    expect(addMonths(D("2026-01-31"), 1)).toEqual({ date: D("2026-02-28"), clamped: true });
    expect(addMonths(D("2024-01-31"), 1)).toEqual({ date: D("2024-02-29"), clamped: true });
    expect(addMonths(D("2026-03-31"), -1)).toEqual({ date: D("2026-02-28"), clamped: true });
    expect(addMonths(D("2026-01-15"), 1)).toEqual({ date: D("2026-02-15"), clamped: false });
    expect(formatIsoDate(addMonths(D("2026-11-30"), 3).date)).toBe("2027-02-28");
    expect(formatIsoDate(addMonths(D("2026-01-10"), -13).date)).toBe("2024-12-10");
  });
  it("years from 29 Feb", () => {
    expect(addYears(D("2024-02-29"), 1)).toEqual({ date: D("2025-02-28"), clamped: true });
    expect(addYears(D("2024-02-29"), 4)).toEqual({ date: D("2028-02-29"), clamped: false });
  });
  it("years and months first, then days", () => {
    expect(iso(addPeriod(D("2026-01-31"), { months: 1, days: 1 }))).toBe("2026-03-01");
    expect(iso(addPeriod(D("2026-11-06"), { years: 1, months: 2, weeks: 1, days: 3 }))).toBe("2028-01-16");
    expect(iso(addPeriod(D("2026-11-06"), { years: 1, months: 2, weeks: 1, days: 3 }, -1))).toBe("2025-08-27");
  });
  it("refuses fractions and the range's edges", () => {
    expect(iso(addPeriod(D("2026-11-06"), { days: 1.5 }))).toBe("error: Use whole numbers");
    expect(iso(addPeriod(D("9999-12-31"), { days: 1 }))).toBe("error: Outside the years 1 to 9999");
    expect(iso(addPeriod(D("0001-01-01"), { days: 1 }, -1))).toBe("error: Outside the years 1 to 9999");
    expect(iso(addPeriod(D("2026-01-01"), { years: 1e9 }))).toBe("error: Outside the years 1 to 9999");
  });
});

describe("years, months and days", () => {
  const diff = (a: string, b: string) => describeYMD(diffYMD(D(a), D(b)));
  it("simple", () => {
    expect(diff("2020-05-10", "2026-11-06")).toBe("6 years, 5 months, 27 days");
    expect(diff("2026-01-01", "2026-01-01")).toBe("0 days");
    expect(diff("2026-01-01", "2027-01-01")).toBe("1 year");
  });
  it("month ends", () => {
    expect(diff("2026-01-31", "2026-02-28")).toBe("28 days");
    expect(diff("2026-01-31", "2026-03-01")).toBe("1 month, 1 day");
    expect(diff("2026-01-31", "2026-03-31")).toBe("2 months");
  });
  it("adding the result back gives the later date", () => {
    const pairs = [["2026-01-31", "2026-03-01"], ["2024-02-29", "2025-03-01"], ["2019-08-31", "2026-02-27"], ["2023-05-17", "2026-11-06"]];
    for (const [a, b] of pairs) {
      const d = diffYMD(D(a!), D(b!));
      expect(iso(addPeriod(D(a!), d))).toBe(b);
    }
  });
  it("backwards has the sign", () => {
    const d = diffYMD(D("2026-11-06"), D("2026-10-01"));
    expect(d.sign).toBe(-1);
    expect(describeYMD(d)).toBe("1 month, 5 days");
  });
  it("weeks and days", () => {
    expect(describeWeeks(23)).toBe("3 weeks, 2 days");
    expect(describeWeeks(14)).toBe("2 weeks");
    expect(describeWeeks(1)).toBe("1 day");
    expect(describeWeeks(-8)).toBe("1 week, 1 day");
  });
});

describe("business days", () => {
  it("Monday to next Monday is 5 (end not counted)", () => expect(businessDays(D("2026-11-02"), D("2026-11-09"))).toBe(5));
  it("counting both ends", () => expect(businessDays(D("2026-11-02"), D("2026-11-09"), true)).toBe(6));
  it("over a weekend", () => expect(businessDays(D("2026-11-06"), D("2026-11-10"))).toBe(2));
  it("weekend only", () => expect(businessDays(D("2026-11-07"), D("2026-11-09"))).toBe(0));
  it("a whole year", () => expect(businessDays(D("2026-01-01"), D("2027-01-01"))).toBe(261));
  it("backwards is negative", () => expect(businessDays(D("2026-11-09"), D("2026-11-02"))).toBe(-5));
  it("Sat-Sun is the default weekend", () => expect(businessDays(D("2026-11-06"), D("2026-11-10"), false, WEEKEND_SAT_SUN)).toBe(2));
  // Israel: Sunday to Thursday. Fri 6 Nov 2026 .. Tue 10 Nov: Sun, Mon (Fri and Sat are the weekend)
  it("a Fri-Sat weekend (Sun-Thu working week)", () => {
    expect(businessDays(D("2026-11-06"), D("2026-11-10"), false, WEEKEND_FRI_SAT)).toBe(2);
    expect(businessDays(D("2026-11-08"), D("2026-11-13"), false, WEEKEND_FRI_SAT)).toBe(5); // Sun to Fri
    expect(businessDays(D("2026-11-08"), D("2026-11-13"), true, WEEKEND_FRI_SAT)).toBe(5); // Fri not counted
    expect(businessDays(D("2026-11-06"), D("2026-11-08"), false, WEEKEND_FRI_SAT)).toBe(0); // Fri, Sat
    expect(businessDays(D("2026-11-07"), D("2026-11-09"), false, WEEKEND_FRI_SAT)).toBe(1); // Sat, Sun
    expect(businessDays(D("2026-11-13"), D("2026-11-08"), false, WEEKEND_FRI_SAT)).toBe(-5);
    expect(businessDays(D("2026-01-01"), D("2027-01-01"), false, WEEKEND_FRI_SAT)).toBe(261);
  });
  it("matches a day-by-day count for any weekend", () => {
    for (const wk of [WEEKEND_SAT_SUN, WEEKEND_FRI_SAT, [7], []])
      for (let n = 0; n < 30; n++) {
        const s = D("2026-11-02"); let c = 0;
        for (let i = 0; i < n; i++) if (!wk.includes(weekday(addDays(s, i)))) c++;
        expect(businessDays(s, addDays(s, n), false, wk)).toBe(c);
      }
  });
  it("matches counting one by one", () => {
    const s = D("2026-01-01");
    for (let n = 0; n < 40; n++) {
      let c = 0;
      for (let i = 0; i < n; i++) if (weekday(addDays(s, i)) <= 5) c++;
      expect(businessDays(s, addDays(s, n))).toBe(c);
    }
  });
});

describe("age", () => {
  it("years, months, days and the next birthday", () => {
    const a = age(D("1990-05-15"), D("2026-11-06"))!;
    expect([a.years, a.months, a.days]).toEqual([36, 5, 22]);
    expect(formatIsoDate(a.nextBirthday)).toBe("2027-05-15");
    expect(a.daysToBirthday).toBe(190);
  });
  it("on the birthday the next one is a year away", () => {
    const a = age(D("2000-11-06"), D("2026-11-06"))!;
    expect(a.years).toBe(26);
    expect(formatIsoDate(a.nextBirthday)).toBe("2027-11-06");
  });
  it("born on 29 Feb turns older on 1 Mar in other years", () => {
    expect(age(D("2024-02-29"), D("2025-02-28"))!.years).toBe(0);
    expect(age(D("2024-02-29"), D("2025-03-01"))!.years).toBe(1);
    const bd = age(D("2024-02-29"), D("2025-03-01"))!;
    expect(describeYMD(bd)).toBe("1 year");
    expect(bd.daysToBirthday).toBe(365);
    expect(formatIsoDate(age(D("2024-02-29"), D("2025-01-10"))!.nextBirthday)).toBe("2025-03-01");
    expect(formatIsoDate(age(D("2024-02-29"), D("2027-03-01"))!.nextBirthday)).toBe("2028-02-29");
  });
  it("no age before birth", () => expect(age(D("2027-01-01"), D("2026-11-06"))).toBeNull());
});

describe("times and durations", () => {
  it("reads durations", () => {
    expect(parseDuration("1:30")).toBe(5400);
    expect(parseDuration("1:30:15")).toBe(5415);
    expect(parseDuration("-0:45")).toBe(-2700);
    expect(parseDuration("−2:00")).toBe(-7200);
    expect(parseDuration("2")).toBe(7200);
    expect(parseDuration("100:05")).toBe(360300);
    expect(parseDuration("")).toBeNull();
  });
  it("refuses bad durations", () => {
    expect(parseDuration("1:75")).toEqual({ error: "Minutes and seconds go up to 59" });
    expect(parseDuration("1h30")).toEqual({ error: "Type hours:minutes, like 1:30" });
  });
  it("reads times of day", () => {
    expect(parseTime("09:30")).toBe(34200);
    expect(parseTime("23:59:59")).toBe(86399);
    expect(parseTime("24:00")).toBe(86400);
    expect(parseTime("24:01")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
  });
  it("formats durations", () => {
    expect(formatDuration(5400)).toBe("1:30");
    expect(formatDuration(5415)).toBe("1:30:15");
    expect(formatDuration(-2700)).toBe("-0:45");
    expect(formatDuration(93600)).toBe("26:00");
    expect(formatDuration(60, true)).toBe("0:01:00");
    expect(describeDuration(93900)).toBe("1 day, 2 hours, 5 minutes");
    expect(describeDuration(0)).toBe("0 minutes");
    expect(describeDuration(-3600)).toBe("minus 1 hour");
  });
  it("time between, past midnight", () => {
    expect(timeBetween(parseTime("09:00")!, parseTime("17:30")!)).toEqual({ seconds: 30600, nextDay: false });
    expect(timeBetween(parseTime("22:00")!, parseTime("06:15")!)).toEqual({ seconds: 29700, nextDay: true });
  });
  it("adding to a time", () => {
    expect(addToTime(parseTime("22:00")!, 5400)).toEqual({ time: 84600, dayOffset: 0 });
    expect(addToTime(parseTime("23:00")!, 7200)).toEqual({ time: 3600, dayOffset: 1 });
    expect(addToTime(parseTime("01:00")!, -7200)).toEqual({ time: 82800, dayOffset: -1 });
  });
  it("adds and takes away durations", () => {
    expect(sumDurations("1:30 + 2:45 - 0:20")).toBe(14100);
    expect(sumDurations("-1:00+0:30")).toBe(-1800);
    expect(sumDurations("8:00 − 0:30")).toBe(27000);
    expect(sumDurations("0:10:30 + 0:00:45")).toBe(675);
    expect(sumDurations("  ")).toBeNull();
  });
  it("refuses a bad sum of durations", () => {
    expect(sumDurations("1:30 2:00")).toEqual({ error: "Put + or - between the times" });
    expect(sumDurations("1:30 + 1:99")).toEqual({ error: "Minutes and seconds go up to 59" });
    expect(sumDurations("1:30 +")).toEqual({ error: "Put + or - between the times" });
  });
});
