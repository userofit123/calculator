import { describe, expect, it } from "vitest";
import {
  readNumber, round2, ceilQ, money, plain, percentOf, whatPercent, percentChange, addPercent, discount, tipSplit, vat, failed, type Q,
} from "../src";
import { parseDecimal } from "../src/rational";

const D = (s: string): Q => parseDecimal(s);
/** a Q as money text, for short expectations */
const M = (a: Q) => money(a).text;
const ok = <T extends object>(r: T | { error: string }): T => { if ("error" in r) throw new Error(r.error); return r as T; };
const num = (s: string, mark: "." | "," = ".", percent = false) => { const r = readNumber(s, mark, percent); if (!r || "error" in r) throw new Error("not a number: " + s); return r; };

describe("reading fields", () => {
  it("empty is null", () => { expect(readNumber("")).toBeNull(); expect(readNumber("   ")).toBeNull(); });
  it("a plain number", () => expect(M(num("12.5").q)).toBe("12.50"));
  it("an expression", () => expect(M(num("12.50 + 8.20").q)).toBe("20.70"));
  it("exact decimals: 0.1 + 0.2 is 0.3", () => expect(num("0.1+0.2").q).toEqual(D("0.3")));
  it("decimal comma and grouping", () => expect(num("1.234,56", ",").q).toEqual(D("1234.56")));
  it("grouping with the point mark", () => expect(num("1,234.5").q).toEqual(D("1234.5")));
  it("ASCII operators", () => expect(num("3*4-2").q).toEqual(D("10")));
  it("a percent field may end in %", () => expect(num("15%", ".", true).q).toEqual(D("15")));
  it("% elsewhere keeps the calculator's meaning", () => expect(num("50%").q).toEqual(D("0.5")));
  it("an inexact expression is marked approx", () => { expect(num("√2").approx).toBe(true); expect(num("2").approx).toBe(false); });
  it("nonsense is an error", () => expect(failed(readNumber("2+"))).toBe(true));
  it("an assignment is not a number", () => expect(failed(readNumber("x=5"))).toBe(true));
});

describe("rounding money", () => {
  it("always two decimals", () => { expect(M(D("3"))).toBe("3.00"); expect(M(D("3.5"))).toBe("3.50"); });
  it("rounded half away from zero", () => { expect(M(D("2.345"))).toBe("2.35"); expect(M(D("-2.345"))).toBe("-2.35"); });
  it("says when it rounded", () => { expect(money(D("1.005")).rounded).toBe(true); expect(money(D("1.5")).rounded).toBe(false); });
  it("thirds", () => expect(money({ n: 100n, d: 3n })).toEqual({ text: "33.33", rounded: true }));
  it("round2 and ceil", () => { expect(round2(D("0.125"))).toEqual(D("0.13")); expect(ceilQ(D("33.34"))).toEqual(D("34")); expect(ceilQ(D("-1.5"))).toEqual(D("-1")); expect(ceilQ(D("7"))).toEqual(D("7")); });
  it("plain numbers drop trailing zeros", () => { expect(plain(D("12.5000"))).toEqual({ text: "12.5", rounded: false }); expect(plain({ n: 1n, d: 3n }, 2)).toEqual({ text: "0.33", rounded: true }); });
});

describe("percent", () => {
  it("15% of 80 is 12", () => expect(percentOf(D("15"), D("80"))).toEqual(D("12")));
  it("17.5% of 19.99", () => expect(M(percentOf(D("17.5"), D("19.99")))).toBe("3.50"));
  it("30 is 25% of 120", () => expect(ok(whatPercent(D("30"), D("120")))).toEqual(D("25")));
  it("nothing is a percentage of 0", () => expect(failed(whatPercent(D("5"), D("0")))).toBe(true));
  it("80 to 100 is up 25%", () => { const r = ok(percentChange(D("80"), D("100"))); expect(r.percent).toEqual(D("25")); expect(r.diff).toEqual(D("20")); expect(r.up).toBe(true); });
  it("100 to 80 is down 20%", () => { const r = ok(percentChange(D("100"), D("80"))); expect(r.percent).toEqual(D("-20")); expect(r.down).toBe(true); });
  it("no change", () => { const r = ok(percentChange(D("5"), D("5"))); expect(r.up || r.down).toBe(false); });
  it("from a negative start, a rise is still up", () => expect(ok(percentChange(D("-50"), D("-25"))).percent).toEqual(D("50")));
  it("a change from 0 has no percentage", () => expect(failed(percentChange(D("0"), D("3")))).toBe(true));
  it("200 plus 15%", () => expect(addPercent(D("200"), D("15"))).toEqual({ result: D("230"), part: D("30") }));
  it("200 minus 15%", () => expect(addPercent(D("200"), D("15"), -1).result).toEqual(D("170")));
});

describe("discount", () => {
  it("25% off 80", () => expect(ok(discount(D("80"), [D("25")]))).toEqual({ sale: D("60"), saving: D("20"), percent: D("25") }));
  it("stacked 20% then 10% is 28% off", () => { const r = ok(discount(D("100"), [D("20"), D("10")])); expect(r.sale).toEqual(D("72")); expect(r.percent).toEqual(D("28")); });
  it("an amount off", () => { const r = ok(discount(D("49.99"), [], D("10"))); expect(M(r.sale)).toBe("39.99"); expect(M(r.percent)).toBe("20.00"); });
  it("a percent then an amount off", () => expect(ok(discount(D("200"), [D("10")], D("5"))).sale).toEqual(D("175")));
  it("over the price is an error", () => expect(failed(discount(D("10"), [], D("11")))).toBe(true));
  it("over 100% is an error", () => expect(failed(discount(D("10"), [D("120")]))).toBe(true));
  it("a negative price is an error", () => expect(failed(discount(D("-1"), [D("10")]))).toBe(true));
  it("a free item has 0% saving", () => expect(ok(discount(D("0"), [D("50")])).percent).toEqual(D("0")));
});

describe("tip and split", () => {
  it("15% on 84.20, one person", () => { const r = ok(tipSplit(D("84.20"), D("15"))); expect(M(r.tip)).toBe("12.63"); expect(M(r.total)).toBe("96.83"); expect(r.perPerson).toEqual(r.total); });
  it("split between 4", () => { const r = ok(tipSplit(D("100"), D("20"), D("4"))); expect(r.total).toEqual(D("120")); expect(r.perPerson).toEqual(D("30")); expect(r.uneven).toEqual(D("0")); });
  it("a split that doesn't go into cents says by how much", () => { const r = ok(tipSplit(D("100"), D("0"), D("3"))); expect(M(r.perPerson)).toBe("33.33"); expect(r.uneven).toEqual(D("0.01")); expect(r.over).toBe(false); });
  it("shares rounded up to the cent can come to more", () => { const r = ok(tipSplit(D("200"), D("0"), D("3"))); expect(M(r.perPerson)).toBe("66.67"); expect(r.uneven).toEqual(D("0.01")); expect(r.over).toBe(true); });
  it("rounding each share up", () => {
    const r = ok(tipSplit(D("100"), D("15"), D("3"), true));
    expect(r.perPerson).toEqual(D("39")); expect(r.total).toEqual(D("117")); expect(r.tip).toEqual(D("17")); expect(r.extra).toEqual(D("2"));
  });
  it("rounding up a whole share adds nothing", () => expect(ok(tipSplit(D("90"), D("0"), D("3"), true)).extra).toEqual(D("0")));
  it("people must be a whole number", () => { expect(failed(tipSplit(D("10"), D("10"), D("2.5")))).toBe(true); expect(failed(tipSplit(D("10"), D("10"), D("0")))).toBe(true); });
  it("negative bill or tip is an error", () => { expect(failed(tipSplit(D("-10"), D("10")))).toBe(true); expect(failed(tipSplit(D("10"), D("-1")))).toBe(true); });
});

describe("VAT", () => {
  it("add 20% to 100", () => expect(ok(vat(D("100"), D("20"), "add"))).toEqual({ net: D("100"), vat: D("20"), gross: D("120") }));
  it("remove 20% from 120", () => expect(ok(vat(D("120"), D("20"), "remove"))).toEqual({ net: D("100"), vat: D("20"), gross: D("120") }));
  it("remove 19% from 100 rounds for display", () => { const r = ok(vat(D("100"), D("19"), "remove")); expect(M(r.net)).toBe("84.03"); expect(M(r.vat)).toBe("15.97"); expect(money(r.net).rounded).toBe(true); });
  it("net + VAT is always the gross exactly", () => { const r = ok(vat(D("59.99"), D("7.7"), "remove")); expect(r.gross).toEqual(D("59.99")); expect(M(r.net)).toBe("55.70"); });
  it("0% rate", () => expect(ok(vat(D("10"), D("0"), "add")).vat).toEqual(D("0")));
  it("a negative rate is an error", () => expect(failed(vat(D("10"), D("-5"), "add"))).toBe(true));
});
