<script setup lang="ts">
// The rate graph under the converter's From/To card: the pair's official daily rate over the last month (or 3 months,
// a year) as a line with a soft area under it, the look of Money Manager's account chart (components/charts/LineChart.vue):
// dashed grid, value labels on the left, dates along the bottom, a dashed line and a dot that follow the pointer, a
// finger or the arrow keys, with a small box showing that day and its rate. Drawn as plain SVG, no chart library.
// Time always runs left to right, in Hebrew too. Loaded as its own chunk, only in the Currency category; it asks for
// data only while open and only with online updates on (core/rateHistory.ts), and shows what this device keeps offline.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CURRENCY_NAMES, GRAPH_PERIODS, fixedPair, graphScale, historySource, pairSeries, periodStart, rateText, seriesStats, type GraphPeriod,
} from "@calc/core";
import { history, ensureHistory, heldDays } from "../core/rateHistory";
import { rates } from "../core/rates";
import { show } from "../core/calc";
import { readJson, writeJson } from "../core/prefs";
import { t, lang, locale, currencyName, type Key } from "../core/i18n";
import { canMove, dur } from "../core/motion";
import Icon from "./Icon.vue";

const props = defineProps<{ from: string; to: string }>();

const open = ref(readJson<boolean>("rateGraphOpen", true) !== false);
watch(open, (v) => writeJson("rateGraphOpen", v));
const saved = readJson<string>("rateGraphPeriod", "1M");
const period = ref<GraphPeriod>((GRAPH_PERIODS as string[]).includes(saved) ? (saved as GraphPeriod) : "1M");
watch(period, (v) => writeJson("rateGraphPeriod", v));

/** the period chips are a radio group: the arrow keys move the choice (and the focus) to the next or previous one */
function chipKey(e: KeyboardEvent, p: GraphPeriod) {
  const n = GRAPH_PERIODS.length, i = GRAPH_PERIODS.indexOf(p);
  const rtl = lang.value === "he" ? -1 : 1;
  const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" ? rtl : e.key === "ArrowLeft" ? -rtl : 0;
  if (!d) return;
  e.preventDefault();
  period.value = GRAPH_PERIODS[(i + d + n) % n]!;
  void nextTick(() => ((e.currentTarget as HTMLElement).parentElement?.querySelector("[aria-checked=true]") as HTMLElement | null)?.focus());
}

const online = ref(typeof navigator === "undefined" || navigator.onLine !== false);
const today = () => new Date().toISOString().slice(0, 10);
const start = computed(() => periodStart(today(), period.value));

/** the currencies to ask for (the ECB's codes, "ARS" for the BCRA); a side that can't be drawn (the hryvnia) */
const sides = computed(() => [props.from, props.to].map((c) => ({ code: c, src: historySource(c) })));
const missing = computed(() => sides.value.find((s) => !s.src)?.code ?? "");
const fixed = computed(() => fixedPair(props.from, props.to));
const codes = computed(() => [...new Set(sides.value.flatMap((s) => (s.src && s.src.src !== "fixed" ? [s.src.code] : [])))]);

function load() { if (open.value && !missing.value && !fixed.value && codes.value.length) void ensureHistory(codes.value, start.value); }
watch([codes, start, open, () => rates.online], load, { immediate: true });
const back = () => { online.value = true; load(); }, gone = () => { online.value = false; };
onMounted(() => { addEventListener("online", back); addEventListener("offline", gone); });
onBeforeUnmount(() => { removeEventListener("online", back); removeEventListener("offline", gone); });

const series = computed(() => (missing.value || fixed.value ? [] : pairSeries(props.from, props.to, heldDays(), start.value)));
const stats = computed(() => seriesStats(series.value));

/** "6 Nov" or "Nov 2025" (a year), in the language shown */
const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString(locale(), { ...o, timeZone: "UTC" });
const longDay = (d: string) => fmtDay(d, { day: "numeric", month: "short", year: "numeric" });
/** t() for params with Hebrew dates in them: those must not be isolated left to right (see ConverterPage) */
const tr = (key: Key, p: Record<string, string>) => t(key).replace(/\{(\w+)\}/g, (m, k: string) => p[k] ?? m);
const num = (n: number) => show(rateText(n));

const sourceLine = computed(() => {
  const s = new Set(codes.value.map((c) => (c === "ARS" ? "bcra" : "ecb")));
  const src = [...s].map((id) => t(("conv.bank." + id) as Key)).join(" · ");
  return stats.value ? tr("conv.graph.asOf", { source: src, date: longDay(stats.value.last.day) }) : src;
});
const summary = computed(() => {
  const st = stats.value;
  if (!st) return "";
  const pct = st.change.replace(/^-/, ""), key: Key = st.change === "0" ? "conv.graph.same" : st.change.startsWith("-") ? "conv.graph.down" : "conv.graph.up";
  return t(key, { to: props.to, from: props.from, period: t(("conv.graph.long." + period.value) as Key), a: num(st.first.value), b: num(st.last.value), pct: show(pct) });
});
const changeText = computed(() => (stats.value ? `${stats.value.change.startsWith("-") ? "−" + show(stats.value.change.slice(1)) : (stats.value.change === "0" ? "" : "+") + show(stats.value.change)}%` : ""));
const state = computed(() => {
  if (series.value.length) return "";
  if (history.loading) return t("conv.graph.loading");
  if (!online.value || !rates.online) return t("conv.graph.needsConnection");
  if (history.failed) return t("conv.graph.failed");
  return codes.value.every((c) => history.held[c]) ? t("conv.graph.empty") : t("conv.graph.needsConnection");
});

// ---- the chart: geometry from the width it has (Money Manager's LineChart, tuned for a card) ----
const wrap = ref<HTMLElement | null>(null);
const width = ref(360);
let ro: ResizeObserver | null = null;
onMounted(() => {
  if (typeof ResizeObserver === "undefined") return;
  ro = new ResizeObserver(([e]) => { const w = Math.round(e?.contentRect.width ?? 0); if (w > 0) width.value = w; });
  watch(wrap, (el, old) => { if (old) ro?.unobserve(old); if (el) ro?.observe(el); }, { immediate: true });
});
onBeforeUnmount(() => ro?.disconnect());

const G = computed(() => {
  const v = series.value.map((p) => p.value), W = Math.max(240, width.value), H = W < 480 ? 170 : 210;
  const sc = graphScale(v), Pl = Math.max(34, 8 + 7 * Math.max(0, ...sc.ticks.map((x) => x.text.length))), Pr = 8, Pt = 12, Pb = 24;
  const x = (i: number) => Pl + (i * (W - Pl - Pr)) / Math.max(1, v.length - 1);
  const y = (n: number) => H - Pb - ((n - sc.lo) / (sc.hi - sc.lo || 1)) * (H - Pb - Pt);
  const pts = v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const base = H - Pb;
  // a few dates along the bottom, evenly spaced, the first and the last included
  const m = Math.max(2, Math.min(v.length, Math.floor((W - Pl - Pr) / 92))), idx = v.length < 2 ? [0] : [...new Set(Array.from({ length: m }, (_, j) => Math.round((j * (v.length - 1)) / (m - 1))))];
  const short: Intl.DateTimeFormatOptions = period.value === "1Y" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
  const labels = v.length ? idx.map((i, j) => ({ x: x(i), t: fmtDay(series.value[i]!.day, short), a: j === 0 ? "start" : j === idx.length - 1 ? "end" : "middle" })) : [];
  return { W, H, Pl, Pr, Pt, Pb, x, y, pts, labels, grid: sc.ticks.map((tk) => ({ y: y(tk.value), t: show(tk.text) })), area: v.length ? `${x(0)},${base} ${pts} ${x(v.length - 1)},${base}` : "", xs: v.map((_, i) => x(i)) };
});

// the point shown: from the pointer (MM's hover and phone scrub) or the arrow keys
const svg = ref<SVGSVGElement | null>(null);
const tip = ref<HTMLElement | null>(null);
const hv = ref<number | null>(null);
function point(e: PointerEvent) {
  if (e.type === "pointerdown" && e.pointerType !== "mouse") try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* a pointer that is gone */ }
  const r = svg.value?.getBoundingClientRect();
  if (!r || !r.width || !series.value.length) return;
  const vx = ((e.clientX - r.left) * G.value.W) / r.width;
  let i = 0, best = Infinity;
  G.value.xs.forEach((x, j) => { const d = Math.abs(x - vx); if (d < best) { best = d; i = j; } });
  hv.value = i;
}
/** the mouse leaving hides the box; after a finger it stays (as MM's scrub) */
function leave(e: PointerEvent) { if (e.pointerType === "mouse") hv.value = null; }
function key(e: KeyboardEvent) {
  const n = series.value.length;
  if (!n) return;
  const i = hv.value ?? n - 1;
  const next = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "Escape" ? -2 : null;
  if (next === null) return;
  e.preventDefault();
  hv.value = next === -2 ? null : Math.max(0, Math.min(n - 1, next));
}
const tipPoint = computed(() => (hv.value !== null && series.value[hv.value] ? series.value[hv.value]! : null));
const tipStyle = computed(() => {
  if (hv.value === null || !tipPoint.value) return { display: "none" };
  const k = G.value.W / width.value, w = tip.value?.offsetWidth || 120, h = tip.value?.offsetHeight || 44;
  const px = G.value.xs[hv.value]! / k, ty = G.value.y(tipPoint.value.value) / k;
  return { left: Math.max(0, Math.min(width.value - w, px - w / 2)) + "px", top: Math.max(0, ty - h - 12) + "px" };
});
const spoken = computed(() => (tipPoint.value ? tr("conv.graph.point", { day: longDay(tipPoint.value.day), rate: `${num(tipPoint.value.value)} ${props.to}` }) : ""));
watch(series, () => { if (hv.value !== null && hv.value >= series.value.length) hv.value = null; });

// draw-in: the line draws itself from the left and the area fades in, when a pair or period is first shown (none with
// reduced motion: canMove)
const line = ref<SVGPolylineElement | null>(null), area = ref<SVGPolygonElement | null>(null);
const drawKey = computed(() => (series.value.length ? `${props.from}|${props.to}|${period.value}|${open.value}` : ""));
watch(drawKey, (k, old) => {
  if (!k || k === old) return;
  nextTick(() => {
    if (!canMove()) return;
    const d = dur(3) * 2.5, easing = "cubic-bezier(.2,.7,.2,1)";
    line.value?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d, easing });
    area.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing });
  });
}, { flush: "post" });

const name = (c: string) => currencyName(c, CURRENCY_NAMES[c] ?? c);
const pairText = computed(() => `${props.from} → ${props.to}`);
const isHe = computed(() => lang.value === "he");
</script>

<template>
  <section class="card rg" :class="{ shut: !open }">
    <div class="rgh">
      <button type="button" class="rgt" :aria-expanded="open" :aria-label="open ? t('conv.graph.hide') : t('conv.graph.show')" @click="open = !open">
        <span class="rgn">{{ t("conv.graph.title") }}</span>
        <span class="rgp num" dir="ltr">{{ pairText }}</span>
        <Icon name="down" class="rgc" />
      </button>
      <div v-if="open && !missing && !fixed" class="rgch" role="radiogroup" :aria-label="t('conv.graph.period')">
        <button v-for="p in GRAPH_PERIODS" :key="p" type="button" role="radio" class="rgchip" :class="{ on: p === period }" :aria-checked="p === period" :tabindex="p === period ? 0 : -1"
          :title="t(('conv.graph.long.' + p) as Key)" @click="period = p" @keydown="chipKey($event, p)">{{ t(("conv.graph." + p) as Key) }}</button>
      </div>
    </div>
    <template v-if="open">
      <p v-if="missing" class="rgnote">{{ t("conv.graph.noHistory", { name: name(missing) }) }}</p>
      <p v-else-if="fixed" class="rgnote">{{ t("conv.graph.fixed") }}</p>
      <template v-else>
        <div v-if="stats" class="rgst">
          <div><span>{{ t("conv.graph.low") }}</span><b class="num">{{ num(stats.min.value) }}</b></div>
          <div><span>{{ t("conv.graph.high") }}</span><b class="num">{{ num(stats.max.value) }}</b></div>
          <div><span>{{ t("conv.graph.change") }}</span><b class="num" dir="ltr">{{ changeText }}</b></div>
        </div>
        <!-- the chart reads left to right in every language: time runs that way -->
        <div v-if="series.length" ref="wrap" class="rgw" dir="ltr" tabindex="0" role="img" :aria-label="summary" :aria-describedby="'rg-keys'"
          @keydown="key" @blur="hv = null">
          <svg ref="svg" :viewBox="`0 0 ${G.W} ${G.H}`" :width="G.W" :height="G.H" aria-hidden="true" @pointermove="point" @pointerdown="point" @pointerleave="leave">
            <defs><linearGradient id="rg-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".32" /><stop offset="1" stop-color="var(--acc)" stop-opacity="0" /></linearGradient></defs>
            <template v-for="(g, k) in G.grid" :key="'g' + k"><line class="gl" :x1="G.Pl" :x2="G.W - G.Pr" :y1="g.y" :y2="g.y" stroke-dasharray="3 5" /><text :x="G.Pl - 6" :y="g.y + 4" text-anchor="end">{{ g.t }}</text></template>
            <polygon ref="area" fill="url(#rg-fill)" :points="G.area" />
            <polyline ref="line" fill="none" stroke="var(--acc)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" :points="G.pts" />
            <circle :cx="G.xs[G.xs.length - 1]" :cy="G.y(series[series.length - 1]!.value)" r="4.5" fill="var(--bg)" stroke="var(--acc)" stroke-width="2.4" />
            <text v-for="(l, i) in G.labels" :key="'l' + i" :x="l.x" :y="G.H - 6" :text-anchor="l.a">{{ l.t }}</text>
            <template v-if="hv !== null && tipPoint">
              <line :x1="G.xs[hv]" :x2="G.xs[hv]" :y1="G.Pt" :y2="G.H - G.Pb" class="hl" stroke-dasharray="3 3" />
              <circle :cx="G.xs[hv]" :cy="G.y(tipPoint.value)" r="5" fill="var(--acc)" stroke="var(--bg)" stroke-width="2" class="hl" />
            </template>
          </svg>
          <div ref="tip" class="rgtip" :dir="isHe ? 'rtl' : 'ltr'" :style="tipStyle" aria-hidden="true">
            <template v-if="tipPoint"><b>{{ longDay(tipPoint.day) }}</b><span class="num"><bdi>{{ num(tipPoint.value) }}</bdi> {{ to }}</span></template>
          </div>
        </div>
        <span id="rg-keys" class="sr">{{ t("conv.graph.keys") }}</span>
        <span class="sr" aria-live="polite">{{ spoken }}</span>
        <p v-if="state" class="rgnote">{{ state }}</p>
        <p v-if="codes.length" class="rgsrc">{{ sourceLine }}</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.rg { display: flex; flex-direction: column; gap: var(--hg); }
.rgh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--hg); }
.rgt { display: flex; align-items: center; gap: 8px; min-width: 0; font: inherit; color: var(--tx); background: none; border: 0; padding: 0; cursor: pointer; text-align: start; }
.rgn { font-size: var(--fs-sm); font-weight: 600; color: var(--tx2); }
.rgp { font-size: var(--fs); font-weight: 600; unicode-bidi: isolate; }
.rgc { width: 18px; height: 18px; color: var(--tx2); transition: transform var(--dur-2) var(--ease); }
/* closed: the chevron points to where the text goes (--dir: 1 left to right, -1 right to left) */
.shut .rgc { transform: rotate(calc(-90deg * var(--dir, 1))); }
.rgch { display: flex; gap: 6px; }
.rgchip { font: inherit; font-size: var(--fs-xs); padding: calc(var(--lpy) * .35) calc(var(--cpx) * .55); border-radius: var(--pill); border: 1px solid var(--ol); background: var(--s1); color: var(--tx); cursor: pointer; white-space: nowrap; }
.rgchip:hover { background: var(--s2); }
.rgchip.on { background: var(--acc); border-color: var(--acc); color: var(--on); font-weight: 600; }
.rgst { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--hg); }
.rgst > div { display: flex; flex-direction: column; min-width: 0; }
.rgst span { font-size: var(--fs-xs); color: var(--tx2); }
.rgst b { font-size: var(--fs); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.rgw { position: relative; touch-action: pan-y; border-radius: var(--r-sm); outline-offset: 2px; }
.rgw svg { display: block; width: 100%; height: auto; overflow: visible; }
.rgw text { font-size: 11px; fill: var(--tx2); font-variant-numeric: tabular-nums; }
.rgw .gl { stroke: var(--ol); }
.rgw .hl { pointer-events: none; }
.rgw line.hl { stroke: var(--tx); stroke-opacity: .35; }
.rgtip { position: absolute; pointer-events: none; display: flex; flex-direction: column; gap: 1px; white-space: nowrap; z-index: 5; background: var(--s2); border: 1px solid var(--ol); border-radius: var(--r-sm); padding: 6px 10px; box-shadow: 0 10px 26px -10px var(--shc); }
.rgtip b { font-size: var(--fs-xs); font-weight: 600; color: var(--tx2); }
.rgtip span { font-size: var(--fs); font-weight: 700; font-variant-numeric: tabular-nums; }
.rgnote { margin: 0; font-size: var(--fs-sm); color: var(--tx2); }
.rgsrc { margin: 0; font-size: var(--fs-xs); color: var(--tx2); }
</style>
