<script setup lang="ts">
// The Calculator's Tip & Split mode (loaded only when chosen; before C-66 also Everyday's "Tip & split" tab):
// the bill, a tip percent from the presets or your own, and the tip itself as the big answer with the total under it.
// Splitting between people (each one's share, rounded up to a whole amount if wanted) is optional. The bill and the
// percent take sums ("42.50 + 18") in the user's decimal mark; the maths is @calc/core's tipSplit (exact, money
// rounded to 2 decimals only for display). Everything typed or picked is remembered on this device.
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { readNumber, money, plain, tipSplit, formatDisplay, type Q } from "@calc/core";
import { settings } from "../core/calc";
import { isPhone } from "../core/device";
import { lower, t, type Key, useTexts } from "../core/i18n";
import { tip as texts } from "../i18n/en/tip";
// this part loads lazily: its English texts come with it
useTexts(texts);
import { tMsg } from "../core/msg";
import { readJson, writeJson } from "../core/prefs";
import { copyToClipboard as copy } from "../core/toast";
import { collapse, play, vSwap } from "../core/motion";

const PRESETS = ["10", "12", "15", "18", "20", "25"];
interface Kept { bill: string; pct: string; custom: boolean; customPct: string; split: boolean; people: string; roundUp: boolean }
const DEF: Kept = { bill: "", pct: "15", custom: false, customPct: "", split: false, people: "2", roundUp: false };
// Everyday's tip tab kept bill, tip, people and roundUp under "everydayCalc" before this form: taken over once
function savedState(): Partial<Kept> {
  const s = readJson<Partial<Kept> | null>("tipCalc", null);
  if (s) return s;
  const e = readJson<Record<string, unknown>>("everydayCalc", {});
  const tip = typeof e.tip === "string" ? e.tip.trim() : "", people = typeof e.people === "string" ? e.people.trim() : "";
  return {
    bill: typeof e.bill === "string" ? e.bill : undefined,
    ...(tip ? (PRESETS.includes(tip) ? { pct: tip } : { custom: true, customPct: tip }) : {}),
    ...(people && people !== "1" ? { split: true, people } : {}),
    roundUp: typeof e.roundUp === "boolean" ? e.roundUp : undefined,
  };
}
const saved = savedState();
// only values of the right type are taken back (an old or edited entry can't break the page)
const st = reactive<Kept>(Object.fromEntries(Object.entries(DEF).map(([k, v]) => [k, typeof saved[k as keyof Kept] === typeof v ? saved[k as keyof Kept] : v])) as unknown as Kept);
if (!PRESETS.includes(st.pct)) st.pct = DEF.pct;
watch(st, (v) => writeJson("tipCalc", v), { deep: true });

// ---- the answer ----
type Num = ReturnType<typeof readNumber>;
const rd = (s: string, percent = false): Num => readNumber(s, settings.decimalMark, percent);
const has = (n: Num): n is { q: Q; approx: boolean } => !!n && !("error" in n);
const errOf = (n: Num) => (n && "error" in n ? n.error : "");
/** shown with the chosen decimal mark and grouping; copied with the decimal mark only (pastes back as a number) */
const shown = (s: string) => formatDisplay(s, settings);
const copied = (s: string) => formatDisplay(s, { decimalMark: settings.decimalMark });

interface Val { text: string; copy: string }
interface Res { error: string; tip: Val | null; of: string; total: Val | null; each: Val | null; extra: Val | null; info: string; note: string }
const pctText = computed(() => (st.custom ? st.customPct : st.pct));
const res = computed<Res>(() => {
  const r: Res = { error: "", tip: null, of: "", total: null, each: null, extra: null, info: "", note: "" };
  const bill = rd(st.bill), pct = rd(pctText.value, true), people = st.split ? rd(st.people || "1") : null;
  r.error = [bill, pct, people].map(errOf).find(Boolean) ?? "";
  if (r.error || !has(bill) || !has(pct) || (st.split && !has(people))) return r;
  const n = people && has(people) ? people.q : undefined;
  const s = tipSplit(bill.q, pct.q, n, st.split && st.roundUp);
  if ("error" in s) { r.error = s.error; return r; }
  let rounded = false;
  const val = (q: Q): Val => { const m = money(q); rounded ||= m.rounded; return { text: shown(m.text), copy: copied(m.text) }; };
  r.tip = val(s.tip);
  r.total = val(s.total);
  r.of = t("tip.of", { p: shown(plain(pct.q, 4).text), bill: shown(money(bill.q).text) });
  if (st.split) {
    r.each = val(s.perPerson);
    if (s.extra.n !== 0n) r.extra = val(s.extra);
    if (n && n.n > 1n && s.uneven.n !== 0n) {
      r.info = t(s.over ? "tip.unevenMore" : "tip.unevenLess", { n: String(n.n), each: shown(money(s.perPerson).text), diff: shown(money(s.uneven).text) });
    }
  }
  const approx = [bill, pct, people].some((x) => has(x) && x.approx);
  r.note = [rounded && t("tip.rounded"), approx && t("tip.inexact")].filter(Boolean).join(" · ");
  return r;
});

/** Custom chosen, a bill typed, but no percent yet: say what is missing instead of the bill prompt */
const needPct = computed(() => st.custom && !st.customPct.trim() && !!st.bill.trim());

/** the rows under the tip: the total, and with a split each one's share and what rounding up added */
const rows = computed(() => ([["tip.total", res.value.total], ["tip.each", res.value.each], ["tip.roundExtra", res.value.extra]] as [Key, Val | null][])
  .flatMap(([k, v]) => (v ? [{ k, v }] : [])));

// ---- choosing ----
const customEl = ref<HTMLInputElement | null>(null), billEl = ref<HTMLInputElement | null>(null);
function pick(p: string) { st.custom = false; st.pct = p; }
function pickCustom() {
  st.custom = true;
  nextTick(() => customEl.value?.focus());
}
// the custom field and the split's fields come in the way other new parts of the calculator do (core/motion.ts)
watch(() => st.custom, (on) => { if (on) nextTick(() => play(customEl.value, "in")); });
/** people as a whole number for the - and + buttons, or null while what is typed isn't one */
const peopleN = computed(() => (/^\s*\d+\s*$/.test(st.people) ? Number(st.people) : null));
function step(by: number) { st.people = String(Math.max(1, (peopleN.value ?? 1) + by)); }

/** "Copy tip" (English puts the row's name in lower case; Hebrew has no case) */
const copyTitle = (k: Key) => t("tip.copyRow", { label: lower(t(k)) });
const ph = computed(() => (settings.decimalMark === "," ? "0,00" : "0.00"));
// in Tip & Split mode on a computer the bill is ready to type into (on a phone the on-screen keyboard would cover the page)
onMounted(() => { if (!isPhone.value) billEl.value?.focus(); });
</script>

<template>
  <div class="tipc" :class="{ phone: isPhone }" role="group" :aria-label="t('tip.form')">
    <div class="card tcard tin">
      <div class="fld">
        <label for="t-bill">{{ t("tip.bill") }}</label>
        <input id="t-bill" ref="billEl" v-model="st.bill" class="num tbill" dir="ltr" type="text" inputmode="decimal" autocomplete="off" :placeholder="ph" />
      </div>
      <div class="fld">
        <div class="tlab">{{ t("tip.pct") }}</div>
        <div class="seg tseg" role="group" :aria-label="t('tip.presets')">
          <button v-for="p in PRESETS" :key="p" type="button" class="num" :data-t="p" :class="{ on: !st.custom && st.pct === p }" :aria-pressed="!st.custom && st.pct === p" @click="pick(p)">{{ p }}%</button>
          <button type="button" data-t="custom" :class="{ on: st.custom }" :aria-pressed="st.custom" @click="pickCustom">{{ t("tip.custom") }}</button>
        </div>
        <input v-if="st.custom" id="t-custom" ref="customEl" v-model="st.customPct" class="num" dir="ltr" type="text" inputmode="decimal" autocomplete="off" :aria-label="t('tip.customPct')" placeholder="16" />
      </div>
    </div>

    <div class="card tcard tres" aria-live="polite" aria-atomic="true">
      <template v-if="res.tip">
        <div class="tlab">{{ t("tip.tip") }}</div>
        <div class="tbigrow">
          <span v-swap:tick="res.tip.text" class="tbig num">{{ res.tip.text }}</span>
          <button type="button" class="ib sm plain" :title="copyTitle('tip.tip')" :aria-label="copyTitle('tip.tip')" @click="copy(res.tip.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button>
        </div>
        <div class="tof">{{ res.of }}</div>
        <div v-for="r in rows" :key="r.k" class="trow" :class="{ main: r.k === 'tip.each' }">
          <span class="grow">{{ t(r.k) }}</span><span v-swap:tick="r.v.text" class="tv num">{{ r.v.text }}</span>
          <button type="button" class="ib sm plain" :title="copyTitle(r.k)" :aria-label="copyTitle(r.k)" @click="copy(r.v.copy)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg></button>
        </div>
        <div v-if="res.info" class="tnote">{{ res.info }}</div>
        <div v-if="res.note" class="tnote">{{ res.note }}</div>
      </template>
      <div v-else-if="res.error" class="tnote twarn" role="alert">{{ tMsg(res.error) }}</div>
      <div v-else-if="needPct" class="tnote">{{ t("tip.enterPct") }}</div>
      <div v-else class="tnote">{{ t("tip.enterBill") }}</div>
    </div>

    <div class="card tcard tsplit">
      <label class="li tg ttg">
        <div class="grow"><div class="t">{{ t("tip.split") }}</div><div class="s">{{ t("tip.splitHint") }}</div></div>
        <input v-model="st.split" type="checkbox" />
      </label>
      <Transition v-bind="collapse"><div v-if="st.split" class="tpeople">
        <div class="fld">
          <label for="t-people">{{ t("tip.people") }}</label>
          <div class="tstep">
            <button type="button" class="ib" :aria-label="t('tip.fewer')" :disabled="peopleN !== null && peopleN <= 1" @click="step(-1)"><span aria-hidden="true">−</span></button>
            <input id="t-people" v-model="st.people" class="num" dir="ltr" type="text" inputmode="numeric" autocomplete="off" placeholder="2" />
            <button type="button" class="ib" :aria-label="t('tip.more')" @click="step(1)"><span aria-hidden="true">+</span></button>
          </div>
        </div>
        <label class="li tg ttg">
          <div class="grow"><div class="t">{{ t("tip.roundUp") }}</div><div class="s">{{ t("tip.roundUpHint") }}</div></div>
          <input v-model="st.roundUp" type="checkbox" />
        </label>
      </div></Transition>
    </div>
  </div>
</template>

<style>
/* The tip form (Tip & Split mode). Tokens only, like the rest of the calculator; the page grows with
   the form (.dmode in calc.css). A computer shows the bill and split on one side and the answer on the other; a phone
   (or a narrow window) puts the answer right under the bill and percent, where the thumb and eye already are. */
.tipc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "in res" "split res"; gap: var(--spg); align-items: start; }
.tipc .tin { grid-area: in; }
.tipc .tres { grid-area: res; }
.tipc .tsplit { grid-area: split; }
.tipc.phone { grid-template-columns: minmax(0, 1fr); grid-template-areas: "in" "res" "split"; }
@media (max-width: 760px) { .tipc { grid-template-columns: minmax(0, 1fr); grid-template-areas: "in" "res" "split"; } }
.tcard { display: flex; flex-direction: column; }
.tcard .fld input { width: 100%; font-variant-numeric: tabular-nums; }
.tipc .tseg + input { margin-top: var(--hg); }
.tlab { font-size: var(--fs-sm); font-weight: 600; color: var(--tx2); }
/* the presets always fit: four to a row (10 12 15 18 / 20 25 Custom), never a sideways scroll; the row's own pill
   shape gives way to a rounded block when it takes two lines */
.tipc .tseg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; overflow: visible; border-radius: var(--r); margin: calc(var(--lpy) * .4) 0 0; }
.tipc .tseg button { min-width: 0; padding-inline: 4px; }
.tipc .tbill { font-size: var(--fs-lg); }
.tbigrow { display: flex; align-items: center; gap: var(--hg); }
.tbig { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: calc(var(--fs-val) * 1.6); font-weight: 600; line-height: 1.15; color: var(--acc); user-select: text; }
.tipc.phone .tbig { font-size: calc(var(--fs-val) * 1.4); }
.tof { font-size: var(--fs-sm); color: var(--tx2); margin-bottom: var(--hg); }
.trow { display: flex; align-items: center; gap: var(--hg); padding-block: calc(var(--lpy) * .4); border-top: 1px solid var(--ol); }
.trow .tv { text-align: end; overflow-wrap: anywhere; min-width: 0; user-select: text; font-size: var(--fs-lg); }
.trow.main .tv { font-weight: 600; color: var(--acc); }
.tnote { font-size: var(--fs-sm); color: var(--tx2); margin-top: calc(var(--lpy) * .4); line-height: 1.4; }
.twarn { color: var(--neg); }
.ttg { padding-inline: 0; }
.ttg .t { font-size: var(--fs); }
.ttg .s { font-size: var(--fs-xs); color: var(--tx2); }
/* The split switch keeps the look of a card's only row (the card's padding below it, no divider) whether the people
   section is open or not; the rest of a row's room and its divider line belong to the section instead, so they open
   and close with it (clipped by the collapse animation) rather than snapping in or out when Vue adds or removes it.
   Open, it adds up to what a first row has: --lpy below the text, then the line. */
.card.tsplit > .li.ttg:first-child { padding-bottom: 4px; border-bottom: 0; min-height: calc(var(--lmh) - 2 * var(--lpy) + 8px); }
.tpeople::before { content: ""; display: block; box-sizing: content-box; height: calc(var(--lpy) - 4px); border-bottom: 1px solid var(--ol); }
/* the people field sits right under that line: its label gets the same density-scaled room a list row has above its text */
.tpeople > .fld:first-child { padding-top: var(--lpy); }
.tstep { display: flex; align-items: center; gap: var(--hg); }
.tstep input { flex: 1; text-align: center; }
</style>
