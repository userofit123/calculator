<script setup lang="ts">
// The converter: currency (the ECB's euro reference rates, and central banks' own official rates for currencies the
// ECB doesn't quote, each shown with its bank and day) and every unit category of GNOME's calculator, plus a few
// more. The amount is any expression the calculator understands ("3/4", "12 × 1.5"); the result follows as you type,
// and the list below shows the amount in every unit of the category. The maths (and the unit tables) are in
// @calc/core; this page is loaded only when opened, so none of it holds up the calculator's first screen. The last
// category, units and amount are remembered on this device.
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { UNIT_CATEGORIES, convert, convertAll, currencyCategory, rateDayOf, rateSourceOf, sourceDayOf, shortDay, RATE_SOURCES, FIXED_EURO_RATES, FIXED_EURO_BY, USD_PEGS, sanitizeInput, type Category, type EvalOptions, type Unit } from "@calc/core";
import { settings, show, calc } from "../core/calc";
import { isPhone } from "../core/device";
import { readJson, writeJson } from "../core/prefs";
import { rates, rateDate, refreshRates, autoRefresh } from "../core/rates";
import { toast } from "../core/toast";
import { t, tMaybe, lang, locale, unitName, currencyName, type Key, useTexts } from "../core/i18n";
import { convert as texts } from "../i18n/en/convert";
// this part loads lazily: its English texts come with it
useTexts(texts);
import { tMsg } from "../core/msg";
import { go } from "../shell/nav";
import Icon from "../components/Icon.vue";
import UnitPicker, { type PickOption } from "../components/UnitPicker.vue";
import { play, vSwap } from "../core/motion";

const currency = computed(() => currencyCategory(rates.set));
const categories = computed<Category[]>(() => [currency.value, ...UNIT_CATEGORIES]);

// what most people convert first in each category
const DEFAULTS: Record<string, [string, string]> = {
  currency: ["EUR", "USD"], angle: ["degree", "radian"], length: ["meter", "foot"], area: ["sqm", "sqft"], volume: ["liter", "usgal"],
  mass: ["kg", "pound"], duration: ["hour", "minute"], temperature: ["celsius", "fahrenheit"], storage: ["gigabyte", "gibibyte"],
  speed: ["kmh", "mph"], frequency: ["mhz", "ghz"], energy: ["kcal", "kj"], pressure: ["bar", "psi"], power: ["kw", "hp"],
  force: ["n", "lbf"], fuel: ["l100km", "mpgus"], datarate: ["Mbps", "MBps"],
};
interface Kept { cat: string; amount: string; units: Record<string, [string, string]> }
const kept = readJson<Partial<Kept>>("converter", {});
const st = reactive<Kept>({ cat: typeof kept.cat === "string" ? kept.cat : "currency", amount: typeof kept.amount === "string" ? kept.amount : "1", units: { ...(kept.units ?? {}) } });
watch(st, (v) => writeJson("converter", v), { deep: true });

const cat = computed(() => categories.value.find((c) => c.id === st.cat) ?? categories.value[0]!);
const has = (c: Category, id: string | undefined) => !!id && c.units.some((u) => u.id === id);
/** the chosen pair, falling back to the defaults for an old saved unit; a saved currency with no rate (the ECB stopped
 *  quoting it) is never swapped for another: it stays chosen and shows "No rate for X" */
const pair = computed<[string, string]>(() => {
  const c = cat.value, saved = st.units[c.id], d = DEFAULTS[c.id] ?? [c.units[0]!.id, c.units[1]!.id];
  const keep = (s: string | undefined) => has(c, s) || (c.id === "currency" && /^[A-Z]{3}$/.test(s ?? ""));
  return [keep(saved?.[0]) ? saved![0] : d[0], keep(saved?.[1]) ? saved![1] : d[1]];
});
const noRate = computed(() => cat.value.id === "currency" ? pair.value.filter((id) => !has(cat.value, id)) : []);
const from = computed({ get: () => pair.value[0], set: (v) => { st.units[cat.value.id] = [v, pair.value[1]]; } });
const to = computed({ get: () => pair.value[1], set: (v) => { st.units[cat.value.id] = [pair.value[0], v]; } });
const unit = (id: string): Unit => cat.value.units.find((u) => u.id === id) ?? { id, name: id, symbol: id, factor: "1", hint: `No rate for ${id}` };
// another category: its card and list come in from the side the chip is on (motion.ts)
const cvg = ref<HTMLElement | null>(null);
watch(() => st.cat, (to, from) => {
  const ids = categories.value.map((c) => c.id), by = ids.indexOf(to) >= ids.indexOf(from) ? 1 : -1;
  nextTick(() => cvg.value?.querySelectorAll(":scope > *").forEach((e) => play(e, "slide", by)));
});
function swap() { st.units[cat.value.id] = [pair.value[1], pair.value[0]]; }

const isCurrency = computed(() => cat.value.id === "currency");
// currencies show their code as the badge, never a flag emoji: Windows draws those as two letters
const options = computed<PickOption[]>(() => [...cat.value.units, ...noRate.value.map(unit)].map((u) => {
  const n = name(u);
  // in Hebrew the English name still finds it ("pound", "yen")
  return { value: u.id, label: n, lead: u.symbol, hint: hint(u), keys: n === u.name ? u.alias : [u.alias, u.name].filter(Boolean).join(" ") };
}));
/** a category's, unit's or currency's name in the language shown (core keeps them in English) */
const catName = (c: Category) => tMaybe("conv.cat." + c.id, c.name);
const name = (u: Unit) => (isCurrency.value ? currencyName(u.id, u.name) : unitName(u.id, u.name));

// the same engine and options as the calculator (its variables and ans too); money to at most 4 decimals
const evalOptions = computed<EvalOptions>(() => ({
  decimals: isCurrency.value ? Math.min(settings.decimals, 4) : settings.decimals, format: settings.format, angle: settings.angle,
  variables: calc.vars, ans: calc.ans, maxBits: 110_000,
}));
const typed = computed(() => sanitizeInput(st.amount, settings.decimalMark));
const result = computed(() => (noRate.value.length ? { error: t("msg.noRate", { x: noRate.value.join(lang.value === "he" ? ", " : " and ") }) } : typed.value ? convert(cat.value, from.value, to.value, typed.value, evalOptions.value) : null));
const all = computed(() => {
  if (!typed.value || noRate.value.includes(from.value)) return [];
  const r = convertAll(cat.value, from.value, typed.value, evalOptions.value);
  return Array.isArray(r) ? r : [];
});
const text = (r: { value: string } | { error: string } | null) => (r && "value" in r ? show(r.value) : "");
/** core's errors are English; the "No rate for" one above is already in the language shown (tMsg leaves it be) */
const errText = computed(() => (result.value && "error" in result.value ? (noRate.value.length ? result.value.error : tMsg(result.value.error)) : ""));
const label = (u: Unit) => u.symbol;

async function copy(s: string) {
  if (!s) return;
  try { await navigator.clipboard.writeText(s); toast(t("c.copied")); } catch { toast(t("c.couldntCopy"), { kind: "err" }); }
}
function pickTo(u: Unit) { if (u.id !== from.value) to.value = u.id; }

/** the ECB's day: most currencies come from it */
const ecbDay = computed(() => sourceDayOf(rates.set, "ecb") || rates.set.date);
const ratesLine = computed(() => tr("conv.ratesOf", { date: lang.value === "he" ? heDay(ecbDay.value) : rateDate(ecbDay.value), source: t("conv.bank.ecb") }));

// core words a currency's source in English (rateSourceLine, the units' hints); the same lines are built here from
// the same tables so they follow the language. English reads exactly as core's.
/** t() for params that are Hebrew text with digits in it (a Hebrew date, a source line): those must not be isolated
 *  left to right as t() does with digits, or "6 בנוב׳ 2026" would read backwards */
const tr = (key: Key, p: Record<string, string>) => t(key).replace(/\{(\w+)\}/g, (m, k: string) => p[k] ?? m);
/** "6 Nov 2026"; in Hebrew the month's name by Intl */
const heDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (d: string) => (lang.value === "he" ? heDay(d) : shortDay(d));
const bank = (src: string) => tMaybe("conv.bank." + src, RATE_SOURCES[src]?.name ?? src);
/** as core's rateSourceLine: "National Bank of Ukraine, 6 Nov 2026", "Fixed at 3.6725 per US dollar (...) · ..." */
function sourceLine(code: string): string {
  const rs = rates.set;
  if (code === "EUR") return "";
  if (rs.rates[code]) return tr("conv.srcDay", { source: bank(rateSourceOf(rs, code)), day: day(rateDayOf(rs, code)) });
  const fixed = FIXED_EURO_RATES[code];
  if (fixed) return FIXED_EURO_BY[code] ? t("conv.fixedEuroBy", { rate: fixed, by: FIXED_EURO_BY[code]! }) : t("conv.fixedEuro", { rate: fixed });
  const peg = USD_PEGS[code];
  if (peg && rs.rates.USD) return tr("conv.fixedUsd", { rate: peg.rate, by: tMaybe("conv.by." + code, peg.by), day: day(rateDayOf(rs, "USD")) });
  return "";
}
/** a unit's hint in the language shown: a currency's source (as currencyCategory words it) or "No rate for X" */
function hint(u: Unit): string | undefined {
  if (!u.hint || !isCurrency.value) return u.hint;
  if (!has(cat.value, u.id)) return tMsg(u.hint);
  const rs = rates.set;
  return rs.rates[u.id] && rateSourceOf(rs, u.id) === "ecb" ? tr("conv.rateOf", { day: day(rateDayOf(rs, u.id)) }) : sourceLine(u.id);
}
/** the chosen currencies whose rate isn't the ECB's of that day, each with its source and day:
 *  "UAH: National Bank of Ukraine, 6 Nov 2026", "AED: Fixed at 3.6725 per US dollar (Central Bank of the UAE) · ..." */
const olderLine = computed(() => !isCurrency.value ? "" : [from.value, to.value]
  .filter((id, i, a) => a.indexOf(id) === i && id !== "EUR" && !noRate.value.includes(id) &&
    !(rates.set.rates[id] && rateSourceOf(rates.set, id) === "ecb" && rateDayOf(rates.set, id) === ecbDay.value))
  .map((id) => tr("conv.codeLine", { code: id, line: sourceLine(id) })).join(" · "));
const ratesState = computed(() => rates.loading ? t("conv.checking") : rates.error ? tr("conv.usingAbove", { error: tMsg(rates.error) })
  : rates.set.fetchedAt ? tr("conv.downloaded", { when: new Date(rates.set.fetchedAt).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" }) }) : t("conv.bundled"));

/** a central bank that didn't answer: a calm note with the day of the rate still in use (not an error) */
const unreachedNotes = computed(() => rates.unreached.map((id) => {
  const code = Object.keys(rates.set.rates).find((c) => rateSourceOf(rates.set, c) === id);
  const who = tMaybe("conv.theBank." + id, `the ${RATE_SOURCES[id]?.name ?? id}`);
  return code ? tr("conv.unreachedRate", { name: who, day: day(rateDayOf(rates.set, code)) }) : tr("conv.unreached", { name: who });
}));

const amountEl = ref<HTMLInputElement | null>(null);
onMounted(() => {
  if (!isPhone.value) amountEl.value?.focus({ preventScroll: true });
  // newer rates arrive in the background; the page never waits for them
  if (isCurrency.value) autoRefresh();
});
watch(isCurrency, (c) => { if (c) autoRefresh(); });
</script>

<template>
  <div class="page cvp" :class="{ phone: isPhone }">
    <div class="ph"><div><h1>{{ t("nav.convert") }}</h1></div></div>
    <div class="cvc" role="tablist" :aria-label="t('conv.what')">
      <button v-for="c in categories" :key="c.id" type="button" role="tab" class="cvchip" :class="{ on: c.id === cat.id }" :aria-selected="c.id === cat.id" @click="st.cat = c.id">{{ catName(c) }}</button>
    </div>
    <div ref="cvg" class="cvg">
      <div class="stack">
        <div class="card cvcard">
          <label class="cvl" for="cv-amount">{{ t("c.from") }}</label>
          <div class="cvrow">
            <input id="cv-amount" ref="amountEl" v-model="st.amount" class="cvin" dir="ltr" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
              enterkeyhint="done" :aria-label="t('conv.amountIn', { unit: name(unit(from)) })" :placeholder="t('conv.amount')" />
            <div class="cvu"><UnitPicker v-model="from" :options="options" :title="isCurrency ? t('conv.currency') : t('conv.unit')" /></div>
          </div>
          <div class="cvsw">
            <button type="button" class="ib" :title="t('conv.swap')" :aria-label="t('conv.swap')" @click="swap(); play(($event.currentTarget as HTMLElement).firstElementChild, 'spin')"><Icon name="convert" /></button>
          </div>
          <span class="cvl">{{ t("c.to") }}</span>
          <div class="cvrow">
            <output v-swap:tick="errText || text(result)" class="cvout" :class="errText ? 'err' : 'num'" for="cv-amount" aria-live="polite">
              {{ errText || text(result) || "0" }}
            </output>
            <div class="cvu"><UnitPicker v-model="to" :options="options" :title="isCurrency ? t('conv.currency') : t('conv.unit')" /></div>
          </div>
          <div class="cvact">
            <span class="cvsum num">{{ text(result) ? `${show(typed)} ${label(unit(from))} = ${text(result)} ${label(unit(to))}` : "" }}</span>
            <button type="button" class="ib" :title="t('c.copyResult')" :aria-label="t('c.copyResult')" :disabled="!text(result)" @click="copy(text(result))">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div v-if="isCurrency" class="cvrates">
            <div class="t">{{ ratesLine }}</div>
            <div v-if="olderLine" class="s">{{ olderLine }}</div>
            <div v-for="n in unreachedNotes" :key="n" class="s">{{ n }}</div>
            <div class="s">
              <span>{{ ratesState }}</span>
              <button v-if="rates.online" type="button" class="lnk" :disabled="rates.loading" @click="refreshRates()">{{ t("conv.refresh") }}</button><span v-if="rates.loading" class="spin" aria-hidden="true" />
              <button v-else type="button" class="lnk" @click="go('settings')">{{ t("conv.onlineOff") }}</button>
            </div>
          </div>
        </div>
      </div>
      <section class="cvall">
        <div class="sh first"><h2>{{ t("conv.allUnits") }}</h2><span v-if="isCurrency" class="cvsrc">{{ ratesLine }}</span></div>
        <div class="card flush">
          <button v-for="r in all" :key="r.unit.id" type="button" class="li click lib cvli" :class="{ on: r.unit.id === to, cur: r.unit.id === from }" :aria-pressed="r.unit.id === to" @click="pickTo(r.unit)">
            <span class="cvsym num">{{ label(r.unit) }}</span>
            <span class="grow"><span class="t">{{ name(r.unit) }}</span><span v-if="r.unit.hint" class="s">{{ hint(r.unit) }}</span></span>
            <span class="cvv" :class="{ num: 'value' in r.result }">{{ "value" in r.result ? show(r.result.value) : tMsg(r.result.error) }}</span>
          </button>
          <div v-if="!all.length" class="li cvnone">{{ errText || t("conv.typeAmount") }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cvc { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: var(--spg); }
.cvchip { font: inherit; font-size: var(--fs); padding: calc(var(--lpy) * .6) calc(var(--cpx) * .8); border-radius: var(--pill); border: 1px solid var(--ol); background: var(--s1); color: var(--tx); cursor: pointer; white-space: nowrap; }
.cvchip:hover { background: var(--s2); }
.cvchip.on { background: var(--acc); border-color: var(--acc); color: var(--on); font-weight: 600; }
.cvg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--spg); align-items: start; }
.cvcard { display: flex; flex-direction: column; gap: var(--hg); }
.cvl { font-size: var(--fs-sm); font-weight: 600; color: var(--tx2); }
.cvrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 46%); gap: var(--hg); align-items: center; }
.cvin { width: 100%; font-size: var(--fs-lg); font-variant-numeric: tabular-nums; }
.cvout { display: block; min-width: 0; font-size: var(--fs-val); font-weight: 600; line-height: 1.2; color: var(--acc); overflow-wrap: anywhere; user-select: text; font-variant-numeric: tabular-nums; }
.cvout.err { font-size: var(--fs); font-weight: 400; color: var(--neg); }
.cvsw { display: flex; justify-content: center; }
.cvsw .ib :deep(svg) { transform: rotate(90deg); }
.cvact { display: flex; align-items: center; gap: var(--hg); }
.cvsum { flex: 1; min-width: 0; font-size: var(--fs-sm); color: var(--tx2); overflow-wrap: anywhere; }
.cvact .ib:disabled { opacity: .4; cursor: default; }
.cvrates { border-top: 1px solid var(--ol); padding-top: var(--hg); display: flex; flex-direction: column; gap: 4px; }
.cvrates .t { font-size: var(--fs-sm); font-weight: 600; }
.cvrates .s { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: var(--fs-sm); color: var(--tx2); }
.lnk { font: inherit; background: none; border: 0; padding: 0; color: var(--acc); cursor: pointer; text-decoration: underline; }
.lnk:disabled { opacity: .5; cursor: default; }
.cvsrc { font-size: var(--fs-xs); color: var(--tx2); text-align: end; }
.cvli { gap: 12px; }
.cvli .grow { display: flex; flex-direction: column; }
.cvli .t { font-size: var(--fs); }
.cvli .s { font-size: var(--fs-xs); color: var(--tx2); }
.cvsym { flex: none; min-width: 4.2em; font-size: var(--fs-sm); color: var(--tx2); }
.cvv { flex: 0 1 auto; min-width: 0; max-width: 55%; text-align: end; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cvli.on .cvv, .cvli.on .t { color: var(--acc); font-weight: 600; }
.cvli.cur .cvsym { color: var(--acc); }
.cvnone { color: var(--tx2); }
/* the phone: one column, the categories in a row that scrolls sideways */
.phone .cvg { grid-template-columns: minmax(0, 1fr); }
.phone .cvc { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: calc(-1 * var(--cpx)); padding-inline: var(--cpx); }
.phone .cvout { font-size: calc(var(--fs-val) * .85); }
</style>
