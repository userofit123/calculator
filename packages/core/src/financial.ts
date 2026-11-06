// The financial functions of GNOME's calculator (Financial mode), with GNOME's formulas and argument order, typed as
// Pmt(200000; 0.05/12; 360) or filled in on the Financial keys' forms. Interest rates are per period and decimal
// (5% a year paid monthly is 0.05/12), as in GNOME. The formulas are written once over the evaluator's arithmetic
// (passed in as FinOps), so they stay exact where the maths allows it: Sln, Syd, Gpm and Ddb always, Fv, Pv and Pmt
// over a whole number of periods; Ctrm, Term and Rate need a logarithm or a root and are exact only when it comes out.
import { CalcError } from "./rational";

/** The arithmetic the formulas need, over the evaluator's numbers (exact fractions or approximations) */
export interface FinOps<V> {
  int(n: bigint): V;
  add(a: V, b: V): V;
  sub(a: V, b: V): V;
  mul(a: V, b: V): V;
  div(a: V, b: V): V;
  pow(a: V, b: V): V;
  /** log of x in a base, exact when x is a whole power of it */
  log(x: V, base: V): V;
  sgn(a: V): number;
  /** the value as a whole number, or null */
  whole(a: V): bigint | null;
}

/** Name as GNOME shows it → the arguments in order (as GNOME's forms list them) */
export const FINANCIAL: Record<string, readonly string[]> = {
  Ctrm: ["periodic interest rate", "future value", "present value"],
  Ddb: ["cost", "life", "period"],
  Fv: ["periodic payment", "periodic interest rate", "number of periods"],
  Gpm: ["cost", "margin"],
  Pmt: ["principal", "periodic interest rate", "term"],
  Pv: ["periodic payment", "periodic interest rate", "number of periods"],
  Rate: ["future value", "present value", "term"],
  Sln: ["cost", "salvage", "life"],
  Syd: ["cost", "salvage", "life", "period"],
  Term: ["periodic payment", "future value", "periodic interest rate"],
};
/** Every spelling the parser accepts: as GNOME writes them (Pmt) and in lower case (pmt) */
export const FINANCIAL_NAMES = Object.keys(FINANCIAL).flatMap((n) => [n, n.toLowerCase()]);
const CANON = new Map(Object.keys(FINANCIAL).map((n) => [n.toLowerCase(), n]));
/** The GNOME spelling of a financial function's name, or null when it isn't one */
export const financialName = (f: string) => CANON.get(f.toLowerCase()) ?? null;

export function financial<V>(f: string, args: V[], o: FinOps<V>): V {
  const name = financialName(f);
  if (!name) throw new CalcError("Unknown function " + f);
  const params = FINANCIAL[name]!;
  if (args.length !== params.length) throw new CalcError(`${name} takes ${params.length} numbers: ${params.join("; ")}`);
  const one = o.int(1n), two = o.int(2n);
  const { add, sub, mul, div, pow } = o;
  const above0 = (v: V, what: string) => { if (o.sgn(v) <= 0) throw new CalcError(`${what} must be above 0`); };
  const notNeg = (v: V, what: string) => { if (o.sgn(v) < 0) throw new CalcError(`${what} can't be negative`); };
  /** a whole number of periods, at least 1 */
  const periods = (v: V, what: string) => {
    const n = o.whole(v);
    if (n === null || n < 1n) throw new CalcError(`${what} must be a whole number of periods`);
    return n;
  };
  /** period: a whole number from 1 to the life */
  const period = (v: V, life: bigint) => {
    const n = o.whole(v);
    if (n === null || n < 1n || n > life) throw new CalcError("Period must be a whole number from 1 to the life");
    return n;
  };
  /** (1 + i)^-n, the discount over n periods */
  const discount = (i: V, n: V) => pow(add(one, i), sub(o.int(0n), n));
  const [a, b, c, d] = args as [V, V, V, V];

  switch (name) {
    case "Ctrm": { // compounding periods from present to future value: ln(fv/pv) / ln(1 + i)
      above0(a, "Interest rate"); above0(b, "Future value"); above0(c, "Present value");
      return o.log(div(b, c), add(one, a));
    }
    case "Ddb": { // double-declining balance, the allowance in one period: cost·(2/life)·(1 − 2/life)^(period − 1)
      notNeg(a, "Cost");
      const life = periods(b, "Life"), p = period(c, life);
      const r = div(two, b);
      // a life of 1 would take twice the cost; the allowance never takes more than the book value left
      if (life === 1n) return a;
      return mul(mul(a, r), pow(sub(one, r), o.int(p - 1n)));
    }
    case "Fv": { // future value of equal payments: pmt·((1 + i)^n − 1) / i
      notNeg(b, "Interest rate"); above0(c, "Number of periods");
      if (o.sgn(b) === 0) return mul(a, c); // no interest: the payments added up
      return div(mul(a, sub(pow(add(one, b), c), one)), b);
    }
    case "Gpm": { // resale price for a gross profit margin: cost / (1 − margin)
      if (o.sgn(sub(b, one)) >= 0) throw new CalcError("Margin must be below 1 (100%)");
      return div(a, sub(one, b));
    }
    case "Pmt": { // loan payment at the end of each period: principal·i / (1 − (1 + i)^−n)
      notNeg(b, "Interest rate"); above0(c, "Term");
      if (o.sgn(b) === 0) return div(a, c);
      return div(mul(a, b), sub(one, discount(b, c)));
    }
    case "Pv": { // present value of equal payments: pmt·(1 − (1 + i)^−n) / i
      notNeg(b, "Interest rate"); above0(c, "Number of periods");
      if (o.sgn(b) === 0) return mul(a, c);
      return div(mul(a, sub(one, discount(b, c))), b);
    }
    case "Rate": { // periodic interest from present to future value: (fv/pv)^(1/n) − 1
      above0(a, "Future value"); above0(b, "Present value"); above0(c, "Term");
      return sub(pow(div(a, b), div(one, c)), one);
    }
    case "Sln": { // straight-line depreciation for one period: (cost − salvage) / life
      above0(c, "Life");
      return div(sub(a, b), c);
    }
    case "Syd": { // sum-of-the-years'-digits: (cost − salvage)·(life − period + 1) / (life·(life + 1)/2)
      const life = periods(c, "Life"), p = period(d, life);
      return div(mul(sub(a, b), o.int(life - p + 1n)), o.int((life * (life + 1n)) / 2n));
    }
    case "Term": { // payment periods to save up a future value: ln(1 + fv·i/pmt) / ln(1 + i)
      above0(c, "Interest rate");
      if (o.sgn(a) === 0) throw new CalcError("Periodic payment can't be 0");
      const x = add(one, div(mul(b, c), a));
      // below 1 the "term" would be negative: payments and future value on opposite sides can never meet
      if (o.sgn(sub(x, one)) < 0) throw new CalcError("These payments can't reach that future value");
      return o.log(x, add(one, c));
    }
  }
  throw new CalcError("Unknown function " + f);
}
