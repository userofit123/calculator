// History search, pinning, cap and export (apps/web/src/core/history.ts).
import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
});
import { capHistory, filterHistory, splitPinned, csvCell, toCsv, toText, progInfo, history, histPrefs, addHistory, clearHistory, setKeepHistory, type HistItem } from "../src/core/history";

const it_ = (e: string, r: string, o: Partial<HistItem> = {}): HistItem => ({ e, r, x: r, t: 1700000000000, ...o });

describe("filter", () => {
  const l = [it_("2+3", "5"), it_("Sin(30)", "0.5"), it_("1−9", "−8")];
  it("matches expression or result, case-insensitive", () => {
    expect(filterHistory(l, "SIN").map((h) => h.e)).toEqual(["Sin(30)"]);
    expect(filterHistory(l, "0.5").length).toBe(1);
    expect(filterHistory(l, "  ").length).toBe(3);
  });
  it("treats - and the minus sign alike", () => { expect(filterHistory(l, "-8").length).toBe(1); });
});

describe("pinning and cap", () => {
  it("lists pinned first, keeping order", () => {
    const l = [it_("a", "1"), it_("b", "2", { p: true }), it_("c", "3"), it_("d", "4", { p: true })];
    const s = splitPinned(l);
    expect(s.pinned.map((h) => h.e)).toEqual(["b", "d"]);
    expect(s.rest.map((h) => h.e)).toEqual(["a", "c"]);
  });
  it("the cap never drops pinned entries", () => {
    const l = Array.from({ length: 205 }, (_, i) => it_("e" + i, "1", i >= 203 ? { p: true } : {}));
    const c = capHistory(l);
    expect(c.filter((h) => !h.p).length).toBe(200);
    expect(c.filter((h) => h.p).length).toBe(2);
    expect(c.at(-1)!.e).toBe("e204");
  });
  it("addHistory keeps pinned past 200 and Clear can keep them", () => {
    history.splice(0);
    history.push(it_("old", "1", { p: true }));
    for (let i = 0; i < 210; i++) addHistory("x" + i, String(i), String(i));
    expect(history.filter((h) => !h.p).length).toBe(200);
    expect(history.some((h) => h.e === "old")).toBe(true);
    clearHistory(true);
    expect(history.map((h) => h.e)).toEqual(["old"]);
    clearHistory();
    expect(history.length).toBe(0);
  });
  it("keep history off saves nothing new", () => {
    setKeepHistory(false);
    addHistory("1+1", "2", "2");
    expect(history.length).toBe(0);
    setKeepHistory(true);
    addHistory("1+1", "2", "2");
    expect(history.length).toBe(1);
    expect(histPrefs.keep).toBe(true);
    setKeepHistory(false, true);
    expect(history.length).toBe(0);
    setKeepHistory(true);
  });
});

describe("export", () => {
  it("escapes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("guards against formulas", () => {
    for (const c of ["=1+1", "+1", "-5", "@x"]) expect(csvCell(c)).toBe("'" + c);
    expect(csvCell("=A,B")).toBe("\"'=A,B\"");
  });
  it("writes a header and one row per entry with the programming info", () => {
    const rows = toCsv([it_("FF+1", "100", { b: 16, w: 32, s: false, m: "programming" }), it_("2+3", "5", { m: "basic" })]).trimEnd().split("\r\n");
    expect(rows[0]).toBe("date_time,mode,base,word_size,signed,expression,result");
    expect(rows[1]).toBe("2023-11-14T22:13:20.000Z,programming,16,32,no,FF+1,100");
    expect(rows[2]).toBe("2023-11-14T22:13:20.000Z,basic,,,,2+3,5");
  });
  it("text lines carry the base info", () => {
    expect(progInfo(it_("FF", "FF", { b: 16, w: 8, s: true }))).toBe("HEX, 8-bit, signed");
    expect(toText([it_("2+3", "5"), it_("FF", "FF", { b: 16, w: 8, s: true })])).toBe("2+3 = 5\nFF = FF [HEX, 8-bit, signed]");
  });
});
