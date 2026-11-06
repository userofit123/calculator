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
  ["Pmt(1000; -0.05; 10)", "Interest rate can't be negative"],
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
});
