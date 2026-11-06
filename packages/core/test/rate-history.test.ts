import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  periodStart, historySource, ecbHistoryUrl, bcraHistoryUrl, parseEcbHistoryCsv, parseBcraHistoryJson, fixedPair, pairSeries, rateText, seriesStats, mergeDays, graphScale,
} from "../src/index";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("the rate graph's data", () => {
  const ecb = parseEcbHistoryCsv(fixture("ecb-history.csv"));
  const ars = parseBcraHistoryJson(fixture("bcra-history.json"));

  it("reads the ECB's days, leaving out empty, impossible and non-positive rows", () => {
    expect(Object.keys(ecb).sort()).toEqual(["GBP", "USD"]);
    expect(ecb.USD).toEqual({ "2026-10-26": "1.1188", "2026-10-28": "1.1210", "2026-10-29": "1.1200", "2026-10-30": "1.1150", "2026-11-02": "1.1250" });
    expect(Object.keys(ecb.GBP!)).toHaveLength(5);
    expect(() => parseEcbHistoryCsv("<html>busy</html>")).toThrow();
    expect(parseEcbHistoryCsv("KEY,CURRENCY,TIME_PERIOD,OBS_VALUE\n")).toEqual({});
  });

  it("reads the BCRA's days, leaving out a zero quote and a bad day", () => {
    expect(ars).toEqual({ "2026-11-02": "1731.5782", "2026-10-30": "1720.25" });
    expect(() => parseBcraHistoryJson("not json")).toThrow();
    expect(() => parseBcraHistoryJson('{"results":{}}')).toThrow();
  });

  it("works out cross rates only on the days both sides have", () => {
    const s = pairSeries("USD", "GBP", ecb);
    // 27 Oct: no dollar rate, 29 Oct: no pound rate, so neither is drawn
    expect(s.map((p) => p.day)).toEqual(["2026-10-26", "2026-10-28", "2026-10-30", "2026-11-02"]);
    expect(s[0]!.value).toBeCloseTo(0.8382 / 1.1188, 12);
    expect(pairSeries("EUR", "USD", ecb).map((p) => p.value)).toEqual([1.1188, 1.121, 1.12, 1.115, 1.125]);
    expect(pairSeries("USD", "EUR", ecb)[0]!.value).toBeCloseTo(1 / 1.1188, 12);
    expect(pairSeries("EUR", "USD", ecb, "2026-10-30").map((p) => p.day)).toEqual(["2026-10-30", "2026-11-02"]);
  });

  it("follows the dollar for the Gulf pegs and the euro for the CFA francs, and mixes in the BCRA", () => {
    expect(pairSeries("EUR", "AED", ecb)[0]!.value).toBeCloseTo(1.1188 * 3.6725, 10);
    expect(pairSeries("USD", "AED", ecb).every((p) => Math.abs(p.value - 3.6725) < 1e-9)).toBe(true);
    expect(pairSeries("XOF", "USD", ecb)[0]!.value).toBeCloseTo(1.1188 / 655.957, 12);
    expect(pairSeries("EUR", "ARS", { ARS: ars }).map((p) => p.value)).toEqual([1720.25, 1731.5782]);
    expect(pairSeries("USD", "ARS", { ...ecb, ARS: ars })[0]!.value).toBeCloseTo(1720.25 / 1.115, 10);
    expect(pairSeries("EUR", "JPY", ecb)).toEqual([]);
    expect(fixedPair("EUR", "BGN") && fixedPair("XOF", "XAF")).toBe(true);
    expect(fixedPair("EUR", "USD")).toBe(false);
  });

  it("knows where each currency's history comes from", () => {
    expect(historySource("USD")).toEqual({ src: "ecb", code: "USD" });
    expect(historySource("SAR")).toEqual({ src: "ecb", code: "USD" });
    expect(historySource("ARS")).toEqual({ src: "bcra", code: "ARS" });
    expect(historySource("BGN")).toEqual({ src: "fixed" });
    expect(historySource("UAH")).toBeNull();
    expect(ecbHistoryUrl(["USD", "GBP"], "2026-10-06")).toBe("https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP.EUR.SP00.A?startPeriod=2026-10-06&format=csvdata&detail=dataonly");
    expect(bcraHistoryUrl("2026-10-06", "2026-11-06")).toContain("Cotizaciones/EUR?fechadesde=2026-10-06&fechahasta=2026-11-06");
  });

  it("goes back a month, three months or a year", () => {
    expect(periodStart("2026-11-06", "1M")).toBe("2026-10-06");
    expect(periodStart("2026-11-06", "3M")).toBe("2026-08-06");
    expect(periodStart("2026-11-06", "1Y")).toBe("2025-11-06");
    expect(periodStart("2026-03-31", "1M")).toBe("2026-02-28");
    expect(periodStart("2026-01-15", "1M")).toBe("2025-12-15");
  });

  it("sums up the period and writes rates plainly", () => {
    const st = seriesStats(pairSeries("EUR", "USD", ecb))!;
    expect([st.min.value, st.max.value, st.first.day, st.last.day]).toEqual([1.115, 1.125, "2026-10-26", "2026-11-02"]);
    expect(st.change).toBe("0.55");
    expect(seriesStats([])).toBeNull();
    expect(seriesStats([{ day: "2026-01-01", value: 2 }, { day: "2026-01-02", value: 1 }])!.change).toBe("-50");
    expect(rateText(1.0841999)).toBe("1.0842");
    expect(rateText(157.2345)).toBe("157.23");
    expect(rateText(0.00000123456)).toBe("0.0000012346");
    expect(rateText(1720)).toBe("1720");
  });

  it("keeps a year of days at most when merging", () => {
    expect(mergeDays({ "2025-01-01": "1.1", "2026-10-26": "1.2" }, { "2026-10-27": "1.3", "2026-10-28": "x" }, "2025-11-06")).toEqual({ "2026-10-26": "1.2", "2026-10-27": "1.3" });
  });

  it("labels the value axis to the decimals its step needs", () => {
    const g = graphScale([1.115, 1.125]);
    expect(g.lo).toBeLessThan(1.115);
    expect(g.hi).toBeGreaterThan(1.125);
    expect(g.ticks.map((t) => t.text)).toEqual(["1.1138", "1.1179", "1.1221", "1.1262"]);
    expect(graphScale([655.957, 655.957]).ticks).toHaveLength(4);
    expect(graphScale([]).ticks).toEqual([]);
  });
});
