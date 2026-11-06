import { describe, expect, it } from "vitest";
import { evaluate, FINANCIAL, FUNCTIONS, financialName, type EvalOptions } from "../src";

const v = (e: string, o: EvalOptions = {}) => { const r = evaluate(e, o); return "value" in r ? r.value : "error: " + r.error; };
const err = (e: string) => { const r = evaluate(e); return "error" in r ? r.error : "value: " + r.value; };
const exactOf = (e: string) => { const r = evaluate(e); return "exact" in r ? r.exact : "error: " + r.error; };
const cases = (list: [string, string, EvalOptions?][]) => list.forEach(([e, want, o]) => it(`${e} = ${want}`, () => expect(v(e, o)).toBe(want)));
const errors = (list: [string, string][]) => list.forEach(([e, want]) => it(`${e}: ${want}`, () => expect(err(e)).toBe(want)));
const d2 = { decimals: 2 };

describe("Pmt: periodic payment of a loan", () => cases([
  ["Pmt(200000; 0.05/12; 360)", "1073.64324602428"], // the textbook 30-year mortgage
  ["Pmt(200000; 0.05/12; 360)", "1073.64", d2],
  ["Pmt(100000; 0.06/12; 180)", "843.86", d2],
  ["Pmt(10000; 0.08; 5)", "2504.56", d2],
  ["Pmt(1000; 0.1; 1)", "1100"], // one period: the loan and its interest, exactly
  ["Pmt(1200; 0; 12)", "100"], // no interest: the principal split evenly
  ["pmt(200000; 0.05/12; 360)", "1073.64", d2], // lower case too
  ["Pmt(1000; 0.01; 1000000)", "10"], // too many periods to work out exactly: approximately, not refused
]));

describe("Pv and Fv: present and future value of equal payments", () => cases([
  ["Pv(1073.6432460242; 0.05/12; 360)", "200000", d2],
  ["Pv(100; 0.1; 2)", "173.553719008264"], // 100/1.1 + 100/1.21, exactly 21000/121
  ["Pv(500; 0; 4)", "2000"],
  ["Fv(100; 0.1; 2)", "210"], // exact: 100 + 110
  ["Fv(1000; 0.05; 10)", "12577.89", d2],
  ["Fv(200; 0.06/12; 120)", "32775.87", d2],
  ["Fv(50; 0; 12)", "600"],
]));

describe("Ctrm, Rate and Term: growth over periods", () => cases([
  ["Ctrm(0.1; 121; 100)", "2"], // a whole number of periods comes out exactly
  ["Ctrm(0.05; 2000; 1000)", "14.2066990829", { decimals: 10 }],
  ["Ctrm(0.07; 1000; 1000)", "0"],
  ["Rate(121; 100; 2)", "0.1"], // the root comes out: exactly 10%
  ["Rate(2000; 1000; 10)", "0.0717734625", { decimals: 10 }],
  ["Rate(100; 100; 5)", "0"],
  ["Term(100; 1000; 0.05)", "8.31", d2],
  ["Term(100; 210; 0.1)", "2"], // 100 then 110: two payments, exactly
  ["Term(-100; 210; 0.1)", "error: These payments can't reach that future value"],
]));

describe("Depreciation: Sln, Syd and Ddb", () => cases([
  ["Sln(10000; 1000; 5)", "1800"],
  ["Sln(1000; 100; 3)", "300"],
  ["Sln(1000; 0; 3)", "333.333333333333"],
  ["Syd(10000; 1000; 5; 1)", "3000"], // 9000 × 5/15
  ["Syd(10000; 1000; 5; 5)", "600"], // 9000 × 1/15
  ["Syd(10000; 1000; 5; 1) + Syd(10000; 1000; 5; 2) + Syd(10000; 1000; 5; 3) + Syd(10000; 1000; 5; 4) + Syd(10000; 1000; 5; 5)", "9000"],
  ["Ddb(10000; 5; 1)", "4000"], // 40% of the book value each period
  ["Ddb(10000; 5; 2)", "2400"],
  ["Ddb(10000; 5; 3)", "1440"],
  ["Ddb(1000; 1; 1)", "1000"], // a one-period life takes the whole cost, never more
]));

describe("Gpm: price for a gross profit margin", () => cases([
  ["Gpm(60; 0.4)", "100"],
  ["Gpm(75; 0.25)", "100"],
  ["Gpm(100; 0)", "100"],
  ["Gpm(100; 40%)", "166.666666666667"], // 40% is 0.4
]));

describe("in expressions", () => {
  cases([
    ["Pmt(200000; 0.05/12; 30×12) × 360", "386511.57", d2], // the total paid
    ["2 × Sln(1000; 100; 3)", "600"],
    ["Sln(1000, 100, 3)", "300"], // a comma separates as well (decimal point mode)
    ["Gpm(Sln(1000; 100; 3); 0.5)", "600"],
  ]);
  it("variables and ans work as arguments", () => {
    expect(v("Pmt(p; r/12; n)", { variables: { p: "200000", r: "0.05", n: "360" }, ...d2 })).toBe("1073.64");
    expect(v("Sln(ans; 0; 4)", { ans: "1000" })).toBe("250");
  });
  it("exact answers stay exact (kept in full for ans)", () => {
    expect(exactOf("Sln(1000; 0; 3)")).toBe("1000/3");
    expect(exactOf("Fv(100; 0.1; 2)")).toBe("210");
  });
  it("a long compounding is a double, not a fraction of thousands of digits", () => {
    expect(exactOf("Pmt(200000; 0.05/12; 360)").length).toBeLessThan(40);
  });
});

describe("plain error messages", () => errors([
  ["Pmt(1000; 0.05)", "Pmt takes 3 numbers: principal; periodic interest rate; term"],
  ["Syd(1000; 0; 5)", "Syd takes 4 numbers: cost; salvage; life; period"],
  ["Pmt(1000; -1; 10)", "Interest rate must be above -1 (-100%)"],
  ["Fv(100; -1.5; 10)", "Interest rate must be above -1 (-100%)"],
  ["Pv(100; -1; 10)", "Interest rate must be above -1 (-100%)"],
  ["Pmt(1000; 0.05; 0)", "Term must be above 0"],
  ["Fv(100; 0.05; -1)", "Number of periods must be above 0"],
  ["Ctrm(0; 200; 100)", "Interest rate must be above 0"],
  ["Ctrm(0.05; 200; 0)", "Present value must be above 0"],
  ["Ctrm(0.05; -200; 100)", "Future value must be above 0"],
  ["Term(100; 1000; 0)", "Interest rate must be above 0"],
  ["Term(0; 1000; 0.05)", "Periodic payment can't be 0"],
  ["Rate(200; 0; 5)", "Present value must be above 0"],
  ["Rate(200; 100; 0)", "Term must be above 0"],
  ["Sln(1000; 100; 0)", "Life must be above 0"],
  ["Syd(1000; 100; 4.5; 1)", "Life must be a whole number of periods"],
  ["Syd(1000; 100; 5; 6)", "Period must be a whole number from 1 to the life"],
  ["Syd(1000; 100; 5; 0)", "Period must be a whole number from 1 to the life"],
  ["Ddb(1000; 0; 1)", "Life must be a whole number of periods"],
  ["Ddb(1000; 5; 2.5)", "Period must be a whole number from 1 to the life"],
  ["Ddb(-1000; 5; 1)", "Cost can't be negative"],
  ["Gpm(100; 1)", "Margin must be below 1 (100%)"],
  ["Gpm(100; 1.5)", "Margin must be below 1 (100%)"],
]));

describe("names", () => {
  it("every function is known in GNOME's spelling and in lower case", () => {
    expect(Object.keys(FINANCIAL)).toEqual(["Ctrm", "Ddb", "Fv", "Gpm", "Pmt", "Pv", "Rate", "Sln", "Syd", "Term"]);
    for (const n of Object.keys(FINANCIAL)) { expect(FUNCTIONS.has(n)).toBe(true); expect(FUNCTIONS.has(n.toLowerCase())).toBe(true); }
    expect(financialName("pmt")).toBe("Pmt");
    expect(financialName("sin")).toBe(null);
  });
  it("can't be variables", () => expect(err("pv = 5")).not.toMatch(/^value/));
  it("work in any case", () => {
    expect(v("PMT(200000; 0.05/12; 360)", d2)).toBe("1073.64");
    expect(v("pMt(200000; 0.05/12; 360)", d2)).toBe("1073.64");
    expect(v("FV(100; 0.1; 2)")).toBe("210");
  });
  it("storing to one says it is a built-in name", () => {
    expect(err("rate = 3")).toBe("Can't change rate, it's a built-in name");
    expect(err("Term = 3")).toBe("Can't change Term, it's a built-in name");
    expect(err("sin = 3")).toBe("Can't change sin, it's a built-in name");
  });
  it("one used as a variable says it is a built-in name", () => {
    expect(err("rate")).toBe("rate is a built-in name");
    expect(err("pv × 2")).toBe("pv is a built-in name");
    expect(err("1 + (FV)")).toBe("FV is a built-in name");
  });
});

describe("negative interest rates (as GNOME allows)", () => cases([
  ["Pmt(1000; -0.05; 10)", "74.606535934549"],
  ["Fv(100; -0.02; 12)", "1076.416381326"],
  ["Pv(100; -0.01; 5)", "515.357128133502"],
]));

// 1 + i as a double keeps few of a small rate's digits: the growth is worked out with expm1 / log1p instead
describe("small rates", () => {
  it("Fv(1; 10^−300; 3) = 3", () => expect(v("Fv(1; 10^−300; 3)")).toBe("3"));
  it("Fv(1; 10^−400; 3) = 3 (a rate below a double)", () => expect(v("Fv(1; 10^−400; 3)")).toBe("3"));
  it("Pmt(1000; 10^−12; 360) = 2.77778", () => expect(v("Pmt(1000; 10^−12; 360)", { decimals: 5 })).toBe("2.77778"));
  it("Fv(1; 10^−9; 360) = 360.0000646…", () => expect(v("Fv(1; 10^−9; 360)")).toBe("360.000064620008"));
  it("Rate(2; 1; 10^30) ≈ 6.93×10⁻³¹", () => expect(v("Rate(2; 1; 10^30)")).toBe("6.931471805599×10⁻³¹"));
  it("Ctrm(10^−20; 2; 1) ≈ 6.93×10¹⁹", () => expect(v("Ctrm(10^−20; 2; 1)")).toBe("69314718055994500000"));
  it("Ctrm(10^−400; 2; 1) ≈ 6.93×10³⁹⁹", () => expect(v("Ctrm(10^−400; 2; 1)")).toBe("6.931471805599×10³⁹⁹"));
  it("whole answers stay exact", () => {
    expect(exactOf("Ctrm(0.1; 121; 100)")).toBe("2");
    expect(exactOf("Rate(121; 100; 2)")).toBe("1/10");
    expect(exactOf("Fv(100; 0.1; 2)")).toBe("210");
  });
});

describe("huge numbers of periods", () => {
  it("Pmt tends to the interest alone (a perpetuity)", () => {
    expect(v("Pmt(1000; 0.05; 10^7)")).toBe("50");
    expect(v("Pmt(1000; 0.05; 10^7)", { maxBits: 110_000 })).toBe("50"); // also while typing
    expect(v("Pmt(1000; 0.05; 10^30)")).toBe("50");
  });
  it("Pv tends to payment ÷ rate", () => expect(v("Pv(1; 0.05; 10^7)", { maxBits: 110_000 })).toBe("20"));
  it("Fv really is too large", () => expect(err("Fv(1; 0.05; 10^7)")).toBe("Number is too large"));
});

describe("approximate answers are stored as approximate", () => {
  it("Rate(3^5000; 2^5000; 5000)", () => expect(exactOf("Rate(3^5000; 2^5000; 5000)")).toMatch(/^≈0\.(5|4999)/));
  it("Pmt(1000; 10^−9; 360)", () => expect(exactOf("Pmt(1000; 10^−9; 360)")).toMatch(/^≈2\.7777782791/));
  it("Pmt(200000; 0.05/12; 360)", () => expect(exactOf("Pmt(200000; 0.05/12; 360)")).toMatch(/^≈1073\.64324602/));
});
