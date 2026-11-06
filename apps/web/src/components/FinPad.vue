<script setup lang="ts">
// Financial mode's keys (loaded only when that mode is chosen): GNOME's ten financial functions. Each opens a form with
// GNOME's fields; a field takes a number or a sum (0.05/12, ans, a variable). Calculate types the call in
// (Pmt(200000; 0.05÷12; 360)) and works it out like =, so it is on the display and in history. The same functions can
// be typed straight into a sum. The maths and its checks are in @calc/core (financial.ts).
import { computed, nextTick, reactive, ref } from "vue";
import { enterCall, fieldText, show, workOut } from "../core/calc";
import Sheet from "./Sheet.vue";
import { t, tMaybe, useTexts } from "../core/i18n";
import { fin as texts } from "../i18n/en/fin";
// this part loads lazily: its English texts come with it
useTexts(texts);
import { tMsg } from "../core/msg";

// GNOME's form titles, field labels and descriptions (shortened), as keys: fin.<Id> / fin.<Id>.about for a function,
// fin.f.<field> / fin.f.<field>.hint for a field. The field order is the core's argument order.
type FieldId = "rate" | "cost" | "salvage" | "life" | "period" | "pmt" | "fv" | "pv" | "n" | "gpmCost" | "margin" | "principal" | "termPmt" | "termRate" | "lifeSln";
interface Fn { id: string; fields: FieldId[] }
const FNS: Fn[] = [
  { id: "Ctrm", fields: ["rate", "fv", "pv"] },
  { id: "Ddb", fields: ["cost", "life", "period"] },
  { id: "Fv", fields: ["pmt", "rate", "n"] },
  { id: "Gpm", fields: ["gpmCost", "margin"] },
  { id: "Pmt", fields: ["principal", "rate", "termPmt"] },
  { id: "Pv", fields: ["pmt", "rate", "n"] },
  { id: "Rate", fields: ["fv", "pv", "termRate"] },
  { id: "Sln", fields: ["cost", "salvage", "lifeSln"] },
  { id: "Syd", fields: ["cost", "salvage", "life", "period"] },
  { id: "Term", fields: ["pmt", "fv", "rate"] },
];
const title = (f: Fn) => tMaybe("fin." + f.id, f.id);
const about = (f: Fn) => tMaybe("fin." + f.id + ".about", "");
const label = (fd: FieldId) => t(`fin.f.${fd}`);
const hint = (fd: FieldId) => t(`fin.f.${fd}.hint`);

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
  const s = text.trim();
  if (!s) return tried.value ? { error: t("fin.fillIn") } : {};
  if (/[;=]/.test(fieldText(s))) return { error: t("fin.oneSum") };
  const r = workOut(s);
  if ("error" in r) return { error: tMsg(r.error) };
  return /^−?[\d.]+$/.test(fieldText(s)) ? {} : { value: r.value };
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
  <div class="fkeys finkeys" role="group" :aria-label="t('fin.functions')">
    <button v-for="f in FNS" :key="f.id" type="button" class="key k-fn" :title="title(f)" :aria-label="title(f)" @click="start(f)">{{ f.id }}</button>
  </div>
  <Sheet v-if="open" :title="title(open)" @close="open = null">
    <p class="finabout sm">{{ about(open) }}</p>
    <form id="finform" class="finform" novalidate @submit.prevent="calculate">
      <div v-for="(fd, i) in open.fields" :key="fd" class="fld">
        <label :for="'fin' + i">{{ label(fd) }}</label>
        <input :id="'fin' + i" v-model="values[i]" class="num" autocomplete="off" spellcheck="false" inputmode="text" enterkeyhint="go"
          :aria-invalid="!!states[i]?.error" :aria-describedby="'finh' + i" />
        <div :id="'finh' + i" class="finhint sm" :class="{ err: !!states[i]?.error }">
          <template v-if="states[i]?.error">{{ states[i]!.error }}</template>
          <template v-else-if="states[i]?.value"><span class="num">= {{ show(states[i]!.value!) }}</span> · {{ hint(fd) }}</template>
          <template v-else>{{ hint(fd) }}</template>
        </div>
      </div>
      <div v-if="error" class="sm verr" role="alert">{{ tMsg(error) }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn o" @click="open = null">{{ t("fin.cancel") }}</button>
      <button type="submit" form="finform" class="btn">{{ t("fin.calculate") }}</button>
    </template>
  </Sheet>
</template>

<style>
/* Financial mode. Tokens only, like the rest of the calculator (calc.css). */
.finkeys .key { font-size: calc(var(--kfs) - 6px); }
.finabout { color: var(--tx2); line-height: 1.5; margin-bottom: var(--hg); }
.finhint { color: var(--tx2); margin-top: calc(var(--lpy) * 0.4); line-height: 1.4; }
.finhint.err { color: var(--neg); }
.finform .fld input { font-variant-numeric: tabular-nums; }
html.phone .finkeys { grid-auto-rows: minmax(calc(var(--kh) * .62), auto); }
html:not(.phone) .calc.fin .finkeys { grid-auto-rows: minmax(calc(var(--kh) * .78), auto); }
</style>
