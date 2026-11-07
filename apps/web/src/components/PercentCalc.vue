<script setup lang="ts">
// The Calculator's Percent and Discount modes (loaded only when chosen; Everyday mode's tabs before C-66): percentages,
// and a price after discounts. Results follow as you type. Every field takes an expression ("12.50 + 8.20") in the
// user's decimal mark; the maths is in @calc/core (everyday.ts), exact, with money rounded to 2 decimals only for
// display (a note says so). What was typed is remembered on this device.
import { computed, reactive, watch } from "vue";
import {
  readNumber, money, plain, percentOf, whatPercent, percentChange, addPercent, discount, formatDisplay, type Q, type Fail,
} from "@calc/core";
import { settings } from "../core/calc";
import { isPhone } from "../core/device";
import { lower, t, useTexts } from "../core/i18n";
import { every as texts } from "../i18n/en/every";
// this part loads lazily: its English texts come with it
useTexts(texts);
import { tMsg } from "../core/msg";
import { readJson, writeJson } from "../core/prefs";
import { copyToClipboard as copy } from "../core/toast";
/** which mode's forms: Percent or Discount */
defineProps<{ tool: "percent" | "discount" }>();

interface Kept {
  ofX: string; ofY: string; whatX: string; whatY: string; chA: string; chB: string; pmA: string; pmX: string; pmSub: boolean;
  price: string; off1: string; off2: string; offAmt: string;
}
const DEF: Kept = { ofX: "", ofY: "", whatX: "", whatY: "", chA: "", chB: "", pmA: "", pmX: "", pmSub: false, price: "", off1: "", off2: "", offAmt: "" };
// still the Everyday mode's key, so what was typed there is kept; its tab and the retired VAT fields aren't read, and go
// with the next save (only DEF's keys are written)
const saved = readJson<Partial<Kept>>("everydayCalc", {});
// only values of the right type are taken back (an old or edited entry can't break the page)
const st = reactive<Kept>(Object.fromEntries(Object.entries(DEF).map(([k, v]) => [k, typeof saved[k as keyof Kept] === typeof v ? saved[k as keyof Kept] : v])) as unknown as Kept);
watch(st, (v) => writeJson("everydayCalc", v), { deep: true });

// ---- reading fields and showing results ----
type Num = { q: Q; approx: boolean } | Fail | null;
const rd = (s: string, percent = false): Num => readNumber(s, settings.decimalMark, percent);
const has = (n: Num): n is { q: Q; approx: boolean } => !!n && !("error" in n);
const errOf = (n: Num) => (n && "error" in n ? n.error : "");
/** shown with the chosen decimal mark and grouping; copied with the decimal mark only (pastes back as a number) */
const shown = (s: string) => formatDisplay(s, settings);
const copied = (s: string) => formatDisplay(s, { decimalMark: settings.decimalMark });

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
  o.note = [rounded && t("every.rounded"), approx && t("every.inexact")].filter(Boolean).join(" · ");
  return o;
}
const isErr = <T extends object>(r: T | Fail): r is Fail => "error" in r;

// ---- percent ----
const pOf = computed(() => out([rd(st.ofX, true), rd(st.ofY)], [], ([x, y], _, p) => { p.num(t("every.result"), percentOf(x!, y!), true); }));
const pWhat = computed(() => out([rd(st.whatX), rd(st.whatY)], [], ([x, y], _, p) => {
  const r = whatPercent(x!, y!);
  if (isErr(r)) return r.error;
  p.pct(t("every.result"), r, true);
}));
const pChange = computed(() => out([rd(st.chA), rd(st.chB)], [], ([a, b], _, p) => {
  const r = percentChange(a!, b!);
  if (isErr(r)) return r.error;
  p.pct(t(r.up ? "every.up" : r.down ? "every.down" : "every.same"), r.percent, true);
  p.num(t("every.diff"), r.diff);
}));
const pPlus = computed(() => out([rd(st.pmA), rd(st.pmX, true)], [], ([a, x], _, p) => {
  const r = addPercent(a!, x!, st.pmSub ? -1 : 1);
  p.num(t("every.result"), r.result, true);
  p.num(t(st.pmSub ? "every.takenAway" : "every.added"), r.part);
}));

// ---- discount ----
const disc = computed(() => out([rd(st.price)], [rd(st.off1, true), rd(st.off2, true), rd(st.offAmt)], ([price], [o1, o2, amt], p) => {
  if (!o1 && !o2 && !amt) return;
  const r = discount(price!, [o1, o2].filter((x): x is Q => !!x), amt);
  if (isErr(r)) return r.error;
  p.money(t("every.sale"), r.sale, true);
  p.money(t("every.save"), r.saving);
  p.pct(t("every.offAll"), r.percent);
}));

/** "Copy sale price" (English puts the row's name in lower case; Hebrew has no case) */
const copyTitle = (label: string) => t("every.copyRow", { label: lower(label) });
const ph = computed(() => (settings.decimalMark === "," ? "0,00" : "0.00"));
</script>

<template>
  <div class="ecalc" :class="{ phone: isPhone }">
    <div v-if="tool === 'percent'" class="egrid">
      <div class="card ecard">
        <h3 class="eh" role="heading" aria-level="2">{{ t("every.hOf") }}</h3>
        <div class="epair">
          <div class="fld"><label for="e-ofx">{{ t("every.percent") }}</label><input id="e-ofx" v-model="st.ofX" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="15" /></div>
          <div class="fld"><label for="e-ofy">{{ t("every.of") }}</label><input id="e-ofy" v-model="st.ofY" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="80" /></div>
        </div>
        <template v-for="o in [pOf]" :key="'of'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="copyTitle(r.label)" :aria-label="copyTitle(r.label)" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ tMsg(o.error) }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh" role="heading" aria-level="2">{{ t("every.hWhat") }}</h3>
        <div class="epair">
          <div class="fld"><label for="e-whx">{{ t("every.number") }}</label><input id="e-whx" v-model="st.whatX" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="30" /></div>
          <div class="fld"><label for="e-why">{{ t("every.of") }}</label><input id="e-why" v-model="st.whatY" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="120" /></div>
        </div>
        <template v-for="o in [pWhat]" :key="'what'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="copyTitle(r.label)" :aria-label="copyTitle(r.label)" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ tMsg(o.error) }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh" role="heading" aria-level="2">{{ t("every.hChange") }}</h3>
        <div class="epair">
          <div class="fld"><label for="e-cha">{{ t("c.from") }}</label><input id="e-cha" v-model="st.chA" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="80" /></div>
          <div class="fld"><label for="e-chb">{{ t("c.to") }}</label><input id="e-chb" v-model="st.chB" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="100" /></div>
        </div>
        <template v-for="o in [pChange]" :key="'ch'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="copyTitle(r.label)" :aria-label="copyTitle(r.label)" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ tMsg(o.error) }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
      <div class="card ecard">
        <h3 class="eh" role="heading" aria-level="2">{{ t("every.hPlus") }}</h3>
        <div class="seg sm eseg2"><button type="button" :class="{ on: !st.pmSub }" :aria-pressed="!st.pmSub" @click="st.pmSub = false">{{ t("every.plus") }}</button><button type="button" :class="{ on: st.pmSub }" :aria-pressed="st.pmSub" @click="st.pmSub = true">{{ t("every.minus") }}</button></div>
        <div class="epair">
          <div class="fld"><label for="e-pma">{{ t("every.number") }}</label><input id="e-pma" v-model="st.pmA" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="200" /></div>
          <div class="fld"><label for="e-pmx">{{ t("every.percent") }}</label><input id="e-pmx" v-model="st.pmX" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="15" /></div>
        </div>
        <template v-for="o in [pPlus]" :key="'pm'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="copyTitle(r.label)" :aria-label="copyTitle(r.label)" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ tMsg(o.error) }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
    </div>

    <div v-else class="egrid">
      <div class="card ecard">
        <div class="fld"><label for="e-price">{{ t("every.price") }}</label><input id="e-price" v-model="st.price" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" :placeholder="ph" /></div>
        <div class="epair">
          <div class="fld"><label for="e-off1">{{ t("every.discountPct") }}</label><input id="e-off1" v-model="st.off1" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" placeholder="25" /></div>
          <div class="fld"><label for="e-off2">{{ t("every.another") }}</label><input id="e-off2" v-model="st.off2" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" :placeholder="t('every.optional')" /></div>
        </div>
        <div class="fld"><label for="e-offamt">{{ t("every.amountOff") }}</label><input id="e-offamt" v-model="st.offAmt" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" :placeholder="t('every.optional')" /></div>
        <div class="enote">{{ t("every.discNote") }}</div>
      </div>
      <div class="card ecard" aria-live="polite">
        <template v-for="o in [disc]" :key="'disc'">
          <div v-for="r in o.rows" :key="r.label" class="erow" :class="{ big: r.big }"><span class="grow">{{ r.label }}</span><span class="ev num">{{ r.text }}</span><button type="button" class="ib sm plain" :title="copyTitle(r.label)" :aria-label="copyTitle(r.label)" @click="copy(r.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button></div>
          <div v-if="o.error" class="enote ewarn" role="alert">{{ tMsg(o.error) }}</div>
          <div v-else-if="!o.rows.length" class="enote">{{ t("every.enterPrice") }}</div>
          <div v-else-if="o.note" class="enote">{{ o.note }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/* Calculator's Percent and Discount modes. Tokens only, like the rest of the calculator. Like Date mode, the page grows with its
   forms instead of the keypad's fixed height (.dmode in calc.css). */
.ecalc { display: flex; flex-direction: column; gap: var(--spg); }
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
.erow { display: flex; align-items: center; gap: var(--hg); padding-block: calc(var(--lpy) * .4); }
.erow .ev { text-align: end; overflow-wrap: anywhere; min-width: 0; user-select: text; }
.erow.big .ev { font-size: var(--fs-val); font-weight: 600; line-height: 1.2; color: var(--acc); }
.ecalc.phone .erow.big .ev { font-size: calc(var(--fs-val) * .85); }
</style>
