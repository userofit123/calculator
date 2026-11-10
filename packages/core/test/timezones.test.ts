import { describe, it, expect } from "vitest";
import { convertZoned, type ZoneResult, zonedToUtc, zoneOffset, formatOffset, formatHours, parseClock, timeZones, isTimeZone, zonePlace, zonedFields, WORLD_ZONES } from "../src/timezones";

const at = (iso: string) => Date.parse(iso);
/** a conversion that must come out */
function ok(date: string, time: string, from: string, to: string): ZoneResult {
  const r = convertZoned(date, time, from, to);
  if (!r || "outOfRange" in r) throw new Error(`no result for ${date} ${time} ${from} to ${to}`);
  return r;
}

describe("time zones", () => {
  it("converts a time to another zone", () => {
    const r = ok("2026-11-10", "09:30", "Europe/Paris", "America/New_York");
    expect(r.to).toEqual({ date: { y: 2026, m: 11, d: 10 }, hour: 3, minute: 30 });
    expect(r.utc).toBe(at("2026-11-10T08:30:00Z"));
    expect([r.fromOffset, r.toOffset, r.dayShift]).toEqual([60, -300, 0]);
  });
  it("moves the date across midnight and the date line", () => {
    expect(ok("2026-11-10", "22:00", "Europe/London", "Asia/Tokyo")).toMatchObject({ to: { date: { y: 2026, m: 11, d: 11 }, hour: 7, minute: 0 }, dayShift: 1 });
    expect(ok("2026-01-01", "01:00", "Asia/Tokyo", "America/Los_Angeles")).toMatchObject({ to: { date: { y: 2025, m: 12, d: 31 }, hour: 8 }, dayShift: -1 });
    expect(ok("2026-03-01", "23:30", "Pacific/Kiritimati", "Pacific/Pago_Pago").dayShift).toBe(-1);
  });
  it("moves the date two days between UTC+14 and UTC-11", () => {
    expect(ok("2026-03-01", "00:30", "Pacific/Kiritimati", "Pacific/Pago_Pago")).toMatchObject({ to: { date: { y: 2026, m: 2, d: 27 }, hour: 23, minute: 30 }, dayShift: -2 });
    expect(ok("2026-02-27", "23:30", "Pacific/Niue", "Pacific/Kiritimati")).toMatchObject({ to: { date: { y: 2026, m: 3, d: 1 }, hour: 0, minute: 30 }, dayShift: 2 });
  });
  it("says how far ahead or behind the to clock is", () => {
    expect(ok("2026-11-10", "09:30", "Europe/Paris", "America/New_York")).toMatchObject({ difference: -360, relation: "behind" });
    expect(ok("2026-06-01", "12:00", "UTC", "Asia/Kathmandu")).toMatchObject({ difference: 345, relation: "ahead" });
    expect(ok("2026-06-01", "12:00", "Europe/Paris", "Europe/Berlin")).toMatchObject({ difference: 0, relation: "same" });
    expect(ok("2026-03-01", "00:30", "Pacific/Kiritimati", "Pacific/Pago_Pago")).toMatchObject({ difference: -1500, relation: "behind" });
  });
  it("handles half and quarter hour zones", () => {
    expect(ok("2026-06-01", "12:00", "UTC", "Asia/Kolkata").to).toMatchObject({ hour: 17, minute: 30 });
    expect(ok("2026-06-01", "12:00", "UTC", "Asia/Kathmandu").to).toMatchObject({ hour: 17, minute: 45 });
  });
  it("follows daylight saving time on each side", () => {
    // New York is 5 hours behind London most of the year, 4 in the weeks their changes don't line up
    expect(ok("2026-01-15", "12:00", "Europe/London", "America/New_York").to.hour).toBe(7);
    expect(ok("2026-07-15", "12:00", "Europe/London", "America/New_York").to.hour).toBe(7);
    expect(ok("2026-03-20", "12:00", "Europe/London", "America/New_York").to.hour).toBe(8);
    expect(zoneOffset("Europe/Berlin", at("2026-07-01T00:00:00Z"))).toBe(120);
    expect(zoneOffset("Europe/Berlin", at("2026-12-01T00:00:00Z"))).toBe(60);
    expect(zoneOffset("Australia/Sydney", at("2026-01-01T00:00:00Z"))).toBe(660);
  });
  it("reads a skipped time (clocks forward) as a wall clock would show it", () => {
    // 29 Mar 2026 in Berlin: 02:00 jumps to 03:00
    const r = ok("2026-03-29", "02:30", "Europe/Berlin", "UTC");
    expect(r.skipped).toEqual({ date: { y: 2026, m: 3, d: 29 }, hour: 3, minute: 30 });
    expect(r.to).toMatchObject({ hour: 1, minute: 30 });
    expect(ok("2026-03-29", "03:00", "Europe/Berlin", "UTC").skipped).toBeUndefined();
  });
  it("takes the first of a time that comes twice (clocks back)", () => {
    // 25 Oct 2026 in Berlin: 03:00 goes back to 02:00, so 02:30 happens at 00:30 and 01:30 UTC
    const r = ok("2026-10-25", "02:30", "Europe/Berlin", "UTC");
    expect(r.twice).toBe(true);
    expect(r.to).toMatchObject({ hour: 0, minute: 30 });
    expect(zonedToUtc("Europe/Berlin", { y: 2026, m: 10, d: 25 }, 3, 30)).toEqual({ utc: at("2026-10-25T02:30:00Z"), skipped: false, twice: false });
  });
  it("turns down what isn't a date, time or zone", () => {
    expect(convertZoned("2026-02-30", "10:00", "UTC", "UTC")).toBeNull();
    expect(convertZoned("2026-02-10", "24:00", "UTC", "UTC")).toBeNull();
    expect(convertZoned("2026-02-10", "10:00", "Mars/Olympus", "UTC")).toBeNull();
    expect(isTimeZone("")).toBe(false);
    expect(parseClock("7:05")).toEqual({ hour: 7, minute: 5 });
    expect(parseClock("07:05:30")).toEqual({ hour: 7, minute: 5 });
  });
  it("words offsets and differences", () => {
    expect([formatOffset(0), formatOffset(60), formatOffset(-210), formatOffset(345)]).toEqual(["UTC", "UTC+1", "UTC-3:30", "UTC+5:45"]);
    expect([formatHours(-300), formatHours(330), formatHours(45)]).toEqual(["5", "5:30", "0:45"]);
  });
  it("lists the zones and names their places", () => {
    const all = timeZones();
    expect(all).toContain("UTC");
    expect(all).toContain("Europe/Paris");
    expect(WORLD_ZONES.filter(isTimeZone).length).toBeGreaterThan(15);
    expect(zonePlace("America/Argentina/Buenos_Aires")).toEqual({ place: "Buenos Aires", region: "America · Argentina" });
    expect(zonedFields("Asia/Tokyo", at("2026-11-10T20:05:00Z"))).toEqual({ date: "2026-11-11", time: "05:05" });
  });
  it("says when the same moment is before year 1 or after year 9999 on a clock", () => {
    expect(convertZoned("9999-12-31", "23:00", "UTC", "Asia/Tokyo")).toEqual({ outOfRange: true });
    expect(convertZoned("0001-01-01", "00:30", "Asia/Tokyo", "UTC")).toEqual({ outOfRange: true });
    expect(ok("9999-12-31", "14:59", "UTC", "Asia/Tokyo").to).toEqual({ date: { y: 9999, m: 12, d: 31 }, hour: 23, minute: 59 });
    // Tokyo kept its local mean time (UTC+9:18:59) back then
    expect(ok("0001-01-01", "12:00", "Asia/Tokyo", "UTC").to).toMatchObject({ date: { y: 1, m: 1, d: 1 }, hour: 2 });
  });
  it("works for early years", () => {
    expect(ok("0050-06-01", "12:00", "UTC", "UTC").to.date).toEqual({ y: 50, m: 6, d: 1 });
  });
});
