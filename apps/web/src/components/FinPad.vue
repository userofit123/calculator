<script setup lang="ts">
// Financial mode's keys (loaded only when that mode is chosen): GNOME's ten financial functions. Each opens a form with
// GNOME's fields; a field takes a number or a sum (0.05/12, ans, a variable). Calculate types the call in
// (Pmt(200000; 0.05÷12; 360)) and works it out like =, so it is on the display and in history. The same functions can
// be typed straight into a sum. The maths and its checks are in @calc/core (financial.ts).
import { computed, nextTick, reactive, ref } from "vue";
import { enterCall, fieldText, show, workOut } from "../core/calc";
import Sheet from "./Sheet.vue";

interface Field { label: string; hint: string }
interface Fn { id: string; title: string; about: string; fields: Field[] }
// GNOME's form titles, field labels and descriptions (shortened); the field order is the core's argument order
const RATE: Field = { label: "Periodic interest rate", hint: "Per period, as a decimal: 5% a year paid monthly is 0.05/12" };
const COST: Field = { label: "Cost", hint: "What the asset cost" };
const SALVAGE: Field = { label: "Salvage", hint: "What it is worth at the end of its life" };
const LIFE: Field = { label: "Life", hint: "Useful life in periods (usually years), a whole number" };
const PERIOD: Field = { label: "Period", hint: "The period to work out, from 1 to the life" };
const PMT: Field = { label: "Periodic payment", hint: "The amount paid each period" };
const FV: Field = { label: "Future value", hint: "The amount at the end" };
const PV: Field = { label: "Present value", hint: "The amount now" };
const N: Field = { label: "Number of periods", hint: "How many payments, e.g. 120 for 10 years paid monthly" };
const FNS: Fn[] = [
  { id: "Ctrm", title: "Compounding term", about: "The number of compounding periods it takes an investment to grow from its present value to a future value, at a fixed interest rate per period.", fields: [RATE, FV, PV] },
  { id: "Ddb", title: "Double-declining depreciation", about: "The depreciation of an asset in one period, by the double-declining balance method: twice the straight-line rate, on the value left.", fields: [COST, LIFE, PERIOD] },
  { id: "Fv", title: "Future value", about: "What equal payments at a periodic interest rate grow to over the number of periods.", fields: [PMT, RATE, N] },
  { id: "Gpm", title: "Gross profit margin", about: "The resale price of a product, from its cost and the gross profit margin wanted.", fields: [{ label: "Cost", hint: "What the product cost" }, { label: "Margin", hint: "As a decimal: a 40% margin is 0.4" }] },
  { id: "Pmt", title: "Periodic payment", about: "The payment of a loan each period, paid at the end of each period.", fields: [{ label: "Principal", hint: "The amount borrowed" }, RATE, { label: "Term", hint: "Number of payments: 360 for 30 years paid monthly" }] },
  { id: "Pv", title: "Present value", about: "What equal payments over the number of periods are worth now, discounted at a periodic interest rate.", fields: [PMT, RATE, N] },
  { id: "Rate", title: "Periodic interest rate", about: "The interest rate per period it takes an investment to grow from its present value to a future value over the term. The answer is a decimal: 0.05 is 5%.", fields: [FV, PV, { label: "Term", hint: "Number of compounding periods" }] },
  { id: "Sln", title: "Straight-line depreciation", about: "The depreciation of an asset in one period, the cost less salvage spread evenly over its useful life.", fields: [COST, SALVAGE, { label: "Life", hint: "Useful life in periods (usually years)" }] },
  { id: "Syd", title: "Sum-of-the-years'-digits depreciation", about: "The depreciation of an asset in one period, by the sum-of-the-years'-digits method: more in the early periods, less in the later ones.", fields: [COST, SALVAGE, LIFE, PERIOD] },
  { id: "Term", title: "Payment period", about: "The number of payments it takes to save up a future value, with payments at the end of each period at a periodic interest rate.", fields: [PMT, FV, RATE] },
];

// what was typed in each form stays for the session, so a figure can be changed and worked out again
const typed = reactive<Record<string, string[]>>({});
const open = ref<Fn | null>(null);
const tried = ref(false), error = ref("");
const values = computed(() => (open.value ? typed[open.value.id]! : []));

function start(f: Fn) {
  typed[f.id] ??= f.fields.map(() => "");
  open.value = f; tried.value = false; error.value = "";
  nextTick(() => (document.getElementById("fin0") as HTMLInputElement | null)?.focus());
}
/** a field's state: what it works out to (shown when it is a sum, not a plain number), or why it can't be used */
function state(text: string): { value?: string; error?: string } {
  const t = text.trim();
  if (!t) return tried.value ? { error: "Fill this in" } : {};
  if (/[;=]/.test(fieldText(t))) return { error: "One number or sum per field" };
  const r = workOut(t);
  if ("error" in r) return { error: r.error };
  return /^−?[\d.]+$/.test(fieldText(t)) ? {} : { value: r.value };
}
const states = computed(() => values.value.map(state));

function calculate() {
  const f = open.value;
  if (!f) return;
  tried.value = true; error.value = "";
  if (states.value.some((s) => s.error)) return;
  error.value = enterCall(`${f.id}(${values.value.map(fieldText).join("; ")})`);
  if (!error.value) open.value = null;
}
</script>

<template>
  <div class="fkeys finkeys" role="group" aria-label="Financial functions">
    <button v-for="f in FNS" :key="f.id" type="button" class="key k-fn" :title="f.title" :aria-label="f.title" @click="start(f)">{{ f.id }}</button>
  </div>
  <Sheet v-if="open" :title="open.title" @close="open = null">
    <p class="finabout sm">{{ open.about }}</p>
    <form id="finform" class="finform" novalidate @submit.prevent="calculate">
      <div v-for="(fd, i) in open.fields" :key="fd.label" class="fld">
        <label :for="'fin' + i">{{ fd.label }}</label>
        <input :id="'fin' + i" v-model="values[i]" class="num" autocomplete="off" spellcheck="false" inputmode="text" enterkeyhint="go"
          :aria-invalid="!!states[i]?.error" :aria-describedby="'finh' + i" />
        <div :id="'finh' + i" class="finhint sm" :class="{ err: !!states[i]?.error }">
          <template v-if="states[i]?.error">{{ states[i]!.error }}</template>
          <template v-else-if="states[i]?.value"><span class="num">= {{ show(states[i]!.value!) }}</span> · {{ fd.hint }}</template>
          <template v-else>{{ fd.hint }}</template>
        </div>
      </div>
      <div v-if="error" class="sm verr" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn o" @click="open = null">Cancel</button>
      <button type="submit" form="finform" class="btn">Calculate</button>
    </template>
  </Sheet>
</template>

<style>
/* Financial mode. Tokens only, like the rest of the calculator (calc.css). */
.finkeys .key { font-size: calc(var(--kfs) - 6px); }
.finabout { color: var(--tx2); line-height: 1.5; margin-bottom: var(--hg); }
.finhint { color: var(--tx2); margin-top: 4px; line-height: 1.4; }
.finhint.err { color: var(--neg); }
.finform .fld input { font-variant-numeric: tabular-nums; }
html.phone .finkeys { grid-auto-rows: minmax(calc(var(--kh) * .62), auto); }
html:not(.phone) .calc.fin .finkeys { grid-auto-rows: minmax(calc(var(--kh) * .78), auto); }
</style>
