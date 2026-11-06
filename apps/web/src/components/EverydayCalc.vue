<script setup lang="ts">
// Calculator's Everyday mode (loaded only when chosen, and listed only when switched on in Settings): percentages,
// discounts, tip and splitting a bill, VAT. Results follow as you type. Every field takes an expression ("12.50 + 8.20")
// in the user's decimal mark; the maths is in @calc/core (everyday.ts), exact, with money rounded to 2 decimals only
// for display (a note says so). What was typed is remembered on this device, the VAT rate included.
import { computed, reactive, watch } from "vue";
import {
  readNumber, money, plain, percentOf, whatPercent, percentChange, addPercent, discount, tipSplit, vat, formatDisplay, type Q, type Fail,
} from "@calc/core";
import { settings } from "../core/calc";
import { isPhone } from "../core/device";
import { readJson, writeJson } from "../core/prefs";
import { toast } from "../core/toast";

type Tab = "percent" | "discount" | "tip" | "vat";
const TABS: [Tab, string][] = [["percent", "Percent"], ["discount", "Discount"], ["tip", "Tip & split"], ["vat", "VAT"]];
const TIPS = ["10", "15", "18", "20"];

interface Kept {
  tab: Tab; ofX: string; ofY: string; whatX: string; whatY: string; chA: string; chB: string; pmA: string; pmX: string; pmSub: boolean;
  price: string; off1: string; off2: string; offAmt: string; bill: string; tip: string; people: string; roundUp: boolean;
  amount: string; rate: string; vatRemove: boolean;
}
const DEF: Kept = {
  tab: "percent", ofX: "", ofY: "", whatX: "", whatY: "", chA: "", chB: "", pmA: "", pmX: "", pmSub: false,
  price: "", off1: "", off2: "", offAmt: "", bill: "", tip: "15", people: "1", roundUp: false, amount: "", rate: "20", vatRemove: false,
};
const saved = readJson<Partial<Kept>>("everydayCalc", {});
// only values of the right type are taken back (an old or edited entry can't break the page)
const st = reactive<Kept>(Object.fromEntries(Object.entries(DEF).map(([k, v]) => [k, typeof saved[k as keyof Kept] === typeof v ? saved[k as keyof Kept] : v])) as unknown as Kept);
if (!TABS.some(([t]) => t === st.tab)) st.tab = "percent";
watch(st, (v) => writeJson("everydayCalc", v), { deep: true });

// ---- reading fields and showing results ----
type Num = { q: Q; approx: boolean } | Fail | null;
const rd = (t: string, percent = false): Num => readNumber(t, settings.decimalMark, percent);
const has = (n: Num): n is { q: Q; approx: boolean } => !!n && !("error" in n);
const errOf = (n: Num) => (n && "error" in n ? n.error : "");
/** shown with the chosen decimal mark and grouping; copied with the decimal mark only (pastes back as a number) */
const shown = (t: string) => formatDisplay(t, settings);
const copied = (t: string) => formatDisplay(t, { decimalMark: settings.decimalMark });

interface Row { label: string; text: string; copy: string; big?: boolean }
interface Out { rows: Row[]; note: string; error: string }
interface Put { money(label: string, v: Q, big?: boolean): void; num(label: string, v: Q, big?: boolean): void; pct(label: string, v: Q, big?: boolean): void }
/** One result: nothing until the needed fields are filled; the first field error, or the maths' own; otherwise the
 *  rows `make` puts, with a note when something shown was rounded or an input was inexact (√2, π) */
function out(need: Num[], opt: Num[], make: (v: Q[], o: (Q | null)[], put: Put) => string | void): Out {
  const o: Out = { rows: [], note: "", error: [...need, ...opt].map(errOf).find(Boolean) ?? "" };
  if (o.error || !need.every(has)) return o;
  let rounded = false;
  const row = (label: string, r: { text: string; rounded: boolean }, big = false, unit = "") => {
    rounded ||= r.rounded;
    o.rows.push({ label, text: shown(r.text) + unit, copy: copied(r.text), big });
  };
  const put: Put = {
    money: (l, v, b) => row(l, money(v), b),
    num: (l, v, b) => row(l, plain(v, 4), b),
    pct: (l, v, b) => row(l, plain(v, 4), b, "%"),
  };
  const e = make(need.map((n) => (n as { q: Q }).q), opt.map((n) => (has(n) ? n.q : null)), put);
  if (e) return { rows: [], note: "", error: e };
  const approx = [...need, ...opt].some((n) => has(n) && n.approx);
  o.note = [rounded && "Rounded for display", approx && "From an inexact input"].filter(Boolean).join(" · ");
  return o;
}
const isErr = <T extends object>(r: T | Fail): r is Fail => "error" in r;

// ---- percent ----
const pOf = computed(() => out([rd(st.ofX, true), rd(st.ofY)], [], ([x, y], _, p) => { p.num("Result", percentOf(x!, y!), true); }));
const pWhat = computed(() => out([rd(st.whatX), rd(st.whatY)], [], ([x, y], _, p) => {
  const r = whatPercent(x!, y!);
  if (isErr(r)) return r.error;
  p.pct("Result", r, true);
}));
const pChange = computed(() => out([rd(st.chA), rd(st.chB)], [], ([a, b], _, p) => {
  const r = percentChange(a!, b!);
  if (isErr(r)) return r.error;
  p.pct(r.up ? "Increase" : r.down ? "Decrease" : "No change", r.percent, true);
  p.num("Difference", r.diff);
}));
const pPlus = computed(() => out([rd(st.pmA), rd(st.pmX, true)], [], ([a, x], _, p) => {
  const r = addPercent(a!, x!, st.pmSub ? -1 : 1);
  p.num("Result", r.result, true);
  p.num(st.pmSub ? "Taken away" : "Added", r.part);
}));

// ---- discount ----
const disc = computed(() => out([rd(st.price)], [rd(st.off1, true), rd(st.off2, true), rd(st.offAmt)], ([price], [o1, o2, amt], p) => {
  if (!o1 && !o2 && !amt) return;
  const r = discount(price!, [o1, o2].filter((x): x is Q => !!x), amt);
  if (isErr(r)) return r.error;
  p.money("Sale price", r.sale, true);
  p.money("You save", r.saving);
  p.pct("Off in all", r.percent);
}));

// ---- tip and split ----
const tipRes = computed(() => {
  let info = "";
  const o = out([rd(st.bill), rd(st.tip, true), rd(st.people || "1")], [], ([bill, tip, people], _, p) => {
    const r = tipSplit(bill!, tip!, people!, st.roundUp);
    if (isErr(r)) return r.error;
    p.money("Each person pays", r.perPerson, true);
    p.money("Tip", r.tip);
    p.money("Total", r.total);
    if (r.extra.n !== 0n) p.money("Added by rounding up", r.extra);
    const n = people!.n;
    if (n > 1n && r.uneven.n !== 0n) info = `${n} shares of ${shown(money(r.perPerson).text)} come to ${shown(money(r.uneven).text)} ${r.over ? "more" : "less"} than the total`;
  });
  return { ...o, info };
});

// ---- VAT ----
const vatRes = computed(() => out([rd(st.amount), rd(st.rate, true)], [], ([a, rate], _, p) => {
  const r = vat(a!, rate!, st.vatRemove ? "remove" : "add");
  if (isErr(r)) return r.error;
  p.money(st.vatRemove ? "Without VAT" : "With VAT", st.vatRemove ? r.net : r.gross, true);
  p.money("VAT", r.vat);
  p.money(st.vatRemove ? "With VAT" : "Without VAT", st.vatRemove ? r.gross : r.net);
}));

async function copy(t: string) {
  if (!t) return;
  try { await navigator.clipboard.writeText(t); toast("Copied"); } catch { toast("Couldn't copy", { kind: "err" }); }
}
const ph = computed(() => (settings.decimalMark === "," ? "0,00" : "0.00"));
</script>

<template>
  <div class="ecalc" :class="{ phone: isPhone }">
    <div class="seg eseg" role="tablist" aria-label="Everyday helpers">
      <button v-for="[t, l] in TABS" :key="t" type="button" role="tab" :data-t="t" :class="{ on: st.tab === t }" :aria-selected="st.tab === t" @click="st.tab = t">{{ l }}</button>
    </div>

    <div v-if="st.tab === 'percent'" class="egrid">
      <div class="card ecard">
        <h3 class="eh">Percent of a number</h3>
        <div class="epair">
          <div class="fld"><label for="e-ofx">Percent</label><input id="e-ofx" v-model="st.ofX" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="15" /></div>
          <div class="fld"><label for="e-ofy">Of</label><input id="e-ofy" v-model="st.ofY" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="80" /></div>
        </div>
        <template v-for="o in [pOf]" :key="'of'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh">What percent is it</h3>
        <div class="epair">
          <div class="fld"><label for="e-whx">Number</label><input id="e-whx" v-model="st.whatX" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="30" /></div>
          <div class="fld"><label for="e-why">Of</label><input id="e-why" v-model="st.whatY" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="120" /></div>
        </div>
        <template v-for="o in [pWhat]" :key="'what'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh">Percent change</h3>
        <div class="epair">
          <div class="fld"><label for="e-cha">From</label><input id="e-cha" v-model="st.chA" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="80" /></div>
          <div class="fld"><label for="e-chb">To</label><input id="e-chb" v-model="st.chB" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="100" /></div>
        </div>
        <template v-for="o in [pChange]" :key="'ch'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh">Add or take away a percent</h3>
        <div class="seg sm eseg2"><button type="button" :class="{ on: !st.pmSub }" @click="st.pmSub = false">Plus</button><button type="button" :class="{ on: st.pmSub }" @click="st.pmSub = true">Minus</button></div>
        <div class="epair">
          <div class="fld"><label for="e-pma">Number</label><input id="e-pma" v-model="st.pmA" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="200" /></div>
          <div class="fld"><label for="e-pmx">Percent</label><input id="e-pmx" v-model="st.pmX" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="15" /></div>
        </div>
        <template v-for="o in [pPlus]" :key="'pm'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
    </div>

    <div v-else-if="st.tab === 'discount'" class="egrid">
      <div class="card ecard">
        <div class="fld"><label for="e-price">Price</label><input id="e-price" v-model="st.price" class="num" type="text" inputmode="decimal" autocomplete="off" :placeholder="ph" /></div>
        <div class="epair">
          <div class="fld"><label for="e-off1">Discount %</label><input id="e-off1" v-model="st.off1" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="25" /></div>
          <div class="fld"><label for="e-off2">Then another %</label><input id="e-off2" v-model="st.off2" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="optional" /></div>
        </div>
        <div class="fld"><label for="e-offamt">Amount off</label><input id="e-offamt" v-model="st.offAmt" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="optional" /></div>
        <div class="enote">A second discount is taken off the already reduced price: 20% then 10% is 28% off. An amount off comes last.</div>
      </div>
      <div class="card ecard" aria-live="polite">
        <template v-for="o in [disc]" :key="'disc'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="!o.rows.length" class="enote">Enter a price and a discount.</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
    </div>

    <div v-else-if="st.tab === 'tip'" class="egrid">
      <div class="card ecard">
        <div class="fld"><label for="e-bill">Bill</label><input id="e-bill" v-model="st.bill" class="num" type="text" inputmode="decimal" autocomplete="off" :placeholder="ph" /></div>
        <div class="fld">
          <label for="e-tip">Tip %</label>
          <div class="seg sm eseg2" role="group" aria-label="Quick tip"><button v-for="t in TIPS" :key="t" type="button" :class="{ on: st.tip.trim() === t }" @click="st.tip = t">{{ t }}%</button></div>
          <input id="e-tip" v-model="st.tip" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="Other" />
        </div>
        <div class="fld"><label for="e-people">People</label><input id="e-people" v-model="st.people" class="num" type="text" inputmode="numeric" autocomplete="off" placeholder="1" /></div>
        <label class="li tg etg">
          <div class="grow"><div class="t">Round up each share</div><div class="s">Everyone pays a whole amount, the extra goes to the tip</div></div>
          <input v-model="st.roundUp" type="checkbox" />
        </label>
      </div>
      <div class="card ecard" aria-live="polite">
        <div v-for="r in tipRes.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
        <div v-if="tipRes.error" class="enote ewarn" role="alert">{{ tipRes.error }}</div>
        <div v-else-if="!tipRes.rows.length" class="enote">Enter the bill.</div>
        <template v-else>
          <div v-if="tipRes.info" class="enote">{{ tipRes.info }}</div>
          <div v-if="tipRes.note" class="enote">{{ tipRes.note }}</div>
        </template>
      </div>
    </div>

    <div v-else class="egrid">
      <div class="card ecard">
        <div class="seg sm eseg2"><button type="button" :class="{ on: !st.vatRemove }" @click="st.vatRemove = false">Add VAT</button><button type="button" :class="{ on: st.vatRemove }" @click="st.vatRemove = true">Remove VAT</button></div>
        <div class="fld"><label for="e-amount">{{ st.vatRemove ? "Amount with VAT" : "Amount without VAT" }}</label><input id="e-amount" v-model="st.amount" class="num" type="text" inputmode="decimal" autocomplete="off" :placeholder="ph" /></div>
        <div class="fld"><label for="e-rate">VAT rate %</label><input id="e-rate" v-model="st.rate" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="20" /></div>
        <div class="enote">The rate is remembered for next time.</div>
      </div>
      <div class="card ecard" aria-live="polite">
        <template v-for="o in [vatRes]" :key="'vat'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="'Copy ' + r.label.toLowerCase()" :aria-label="'Copy ' + r.label.toLowerCase()" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ o.error }}</div>
          <div v-else-if="!o.rows.length" class="enote">Enter an amount and a rate.</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/* Calculator's Everyday mode. Tokens only, like the rest of the calculator. Like Date mode, the page grows with its
   forms instead of the keypad's fixed height (the .dmode rules are repeated here: Date's own styles load only with it). */
html.phone .calc.dmode, .calc.dmode { height: auto; min-height: 0; }
html:not(.phone) .calc.dmode { max-width: 900px; }
.ecalc { display: flex; flex-direction: column; gap: var(--spg); }
.ecalc .eseg { margin: 0; }
.ecalc .eseg2 { margin: 0 0 var(--hg); }
.egrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--spg); align-items: start; }
.ecalc.phone .egrid { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 760px) { .egrid { grid-template-columns: minmax(0, 1fr); } }
.ecard { display: flex; flex-direction: column; }
.ecard .fld input { width: 100%; font-variant-numeric: tabular-nums; }
.eh { margin: 0 0 var(--hg); font-size: var(--fs); }
.epair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--hg); }
.enote { font-size: var(--fs-sm); color: var(--tx2); margin-top: calc(var(--lpy) * .4); line-height: 1.4; }
.ewarn { color: var(--neg); }
.etg { padding-inline: 0; }
.etg .t { font-size: var(--fs); }
.etg .s { font-size: var(--fs-xs); color: var(--tx2); }
.erow { display: flex; align-items: center; gap: var(--hg); padding-block: calc(var(--lpy) * .4); }
.erow .ev { text-align: end; overflow-wrap: anywhere; min-width: 0; user-select: text; }
.erow.big .ev { font-size: var(--fs-val); font-weight: 600; line-height: 1.2; color: var(--acc); }
.ecalc.phone .erow.big .ev { font-size: calc(var(--fs-val) * .85); }
</style>
