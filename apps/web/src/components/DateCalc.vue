<script setup lang="ts">
// Calculator's Date mode (loaded only when chosen): days between two dates, adding to or taking away from a date, age,
// and times of day and durations. Results follow as you type. Dates are plain calendar days: a field's "2026-11-06" is
// read as that day, never as a moment in some time zone, and shown in the user's own date format (Intl, pinned to UTC
// so the day shown is the day typed). The maths is in @calc/core (dates.ts). What was typed is remembered on this device.
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  parseDate, formatIsoDate, daysBetween, addDays, addPeriod, diffYMD, businessDays, dayOfYear, daysInYear, isoWeek, age,
  describeYMD, describeWeeks, describeDays, parseTime, sumDurations, formatDuration, describeDuration, timeBetween, type YMD,
} from "@calc/core";
import { isPhone } from "../core/device";
import { readJson, writeJson } from "../core/prefs";
import { toast } from "../core/toast";

type Tab = "between" | "add" | "age" | "time";
const TABS: [Tab, string][] = [["between", "Between dates"], ["add", "Add or subtract"], ["age", "Age"], ["time", "Time"]];

/** today on this device's calendar (local, not UTC: just after midnight it is already the new day here) */
const localToday = () => { const n = new Date(); return formatIsoDate({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }); };
const todayRef = ref(localToday());
const today = computed(() => todayRef.value);
const refreshToday = () => { todayRef.value = localToday(); return todayRef.value; };
let tick: number | undefined;
onMounted(() => { tick = window.setInterval(refreshToday, 60000); document.addEventListener("visibilitychange", refreshToday); });
onUnmounted(() => { window.clearInterval(tick); document.removeEventListener("visibilitychange", refreshToday); });

interface Kept {
  tab: Tab; a: string; b: string; includeEnd: boolean; start: string; sub: boolean;
  years: string; months: string; weeks: string; days: string; birth: string; on: string; t1: string; t2: string; durs: string;
}
const DEF: Kept = {
  tab: "between", a: todayRef.value, b: todayRef.value, includeEnd: false, start: todayRef.value, sub: false,
  years: "", months: "", weeks: "", days: "", birth: "", on: "", t1: "09:00", t2: "17:30", durs: "",
};
const saved = readJson<Partial<Kept>>("dateCalc", {});
// only values of the right type are taken back (an old or edited entry can't break the page)
const st = reactive<Kept>(Object.fromEntries(Object.entries(DEF).map(([k, v]) => [k, typeof saved[k as keyof Kept] === typeof v ? saved[k as keyof Kept] : v])) as unknown as Kept);
if (!TABS.some(([t]) => t === st.tab)) st.tab = "between";
watch(st, (v) => writeJson("dateCalc", v), { deep: true });

// ---- showing dates ----
const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const fmtShort = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const nf = new Intl.NumberFormat();
/** the calendar day as a Date at UTC midnight (setUTCFullYear, so years below 100 aren't read as 19xx) */
const utc = (v: YMD) => { const d = new Date(0); d.setUTCFullYear(v.y, v.m - 1, v.d); return d; };
const long = (v: YMD) => fmtLong.format(utc(v));
const short = (v: YMD) => fmtShort.format(utc(v));
const WD = new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" });
/** "Friday · Week 45 · Day 310 of 365" */
const about = (v: YMD | null) => (v ? `${WD.format(utc(v))} · Week ${isoWeek(v).week} · Day ${dayOfYear(v)} of ${daysInYear(v.y)}` : "");
const dateOf = (s: string) => parseDate(s);

// ---- between two dates ----
const A = computed(() => dateOf(st.a)), B = computed(() => dateOf(st.b));
const between = computed(() => {
  const a = A.value, b = B.value;
  if (!a || !b) return null;
  const back = daysBetween(a, b) < 0, [s, e] = back ? [b, a] : [a, b];
  const end = st.includeEnd ? addDays(e, 1) : e, days = daysBetween(s, end);
  return { days, back, ymd: describeYMD(diffYMD(s, end)), weeks: describeWeeks(days), work: Math.abs(businessDays(s, e, st.includeEnd)) };
});
function swapDates() { [st.a, st.b] = [st.b, st.a]; }

// ---- adding to a date ----
const S = computed(() => dateOf(st.start));
const num = (t: string) => { const x = t.trim().replace(/^[−–]/, "-"); return x === "" ? 0 : /^[+-]?\d+$/.test(x) ? Number(x) : NaN; };
const added = computed(() => {
  const s = S.value;
  if (!s) return null;
  const p = { years: num(st.years), months: num(st.months), weeks: num(st.weeks), days: num(st.days) };
  if (Object.values(p).some(Number.isNaN)) return { error: "Use whole numbers" };
  return addPeriod(s, p, st.sub ? -1 : 1);
});
const addedDate = computed(() => (added.value && "date" in added.value ? added.value.date : null));
const PARTS: [keyof Kept & ("years" | "months" | "weeks" | "days"), string][] = [["years", "Years"], ["months", "Months"], ["weeks", "Weeks"], ["days", "Days"]];

// ---- age ----
const birth = computed(() => dateOf(st.birth)), onDay = computed(() => dateOf(st.on || today.value));
const ageR = computed(() => (birth.value && onDay.value ? age(birth.value, onDay.value) : null));
const ageText = computed(() => (ageR.value ? describeYMD(ageR.value) : ""));

// ---- times ----
const T1 = computed(() => parseTime(st.t1)), T2 = computed(() => parseTime(st.t2));
const span = computed(() => (T1.value !== null && T2.value !== null ? timeBetween(T1.value, T2.value) : null));
const sum = computed(() => sumDurations(st.durs));

// ---- the result to copy on each tab ----
const copyText = computed(() => {
  if (st.tab === "between") return between.value ? `${describeDays(between.value.days)} (${between.value.ymd})` : "";
  if (st.tab === "add") return addedDate.value ? long(addedDate.value) : "";
  if (st.tab === "age") return ageText.value;
  return "";
});
async function copy(t: string) {
  if (!t) return;
  try { await navigator.clipboard.writeText(t); toast("Copied"); } catch { toast("Couldn't copy", { kind: "err" }); }
}
</script>

<template>
  <div class="dcalc" :class="{ phone: isPhone }">
    <div class="seg dseg" role="tablist" aria-label="Date calculation">
      <button v-for="[t, l] in TABS" :key="t" type="button" role="tab" :data-t="t" :class="{ on: st.tab === t }" :aria-selected="st.tab === t" @click="st.tab = t">{{ l }}</button>
    </div>

    <div v-if="st.tab === 'between'" class="dgrid">
      <div class="card dcard">
        <div class="fld">
          <label for="d-a">Start date</label>
          <input id="d-a" v-model="st.a" type="date" min="0001-01-01" max="9999-12-31" />
          <div class="dnote">{{ about(A) || "Pick a date" }}</div>
        </div>
        <div class="fld">
          <label for="d-b">End date</label>
          <input id="d-b" v-model="st.b" type="date" min="0001-01-01" max="9999-12-31" />
          <div class="dnote">{{ about(B) || "Pick a date" }}</div>
        </div>
        <div class="dbtns">
          <button type="button" class="btn o sm" @click="swapDates">Swap</button>
          <button type="button" class="btn o sm" @click="st.a = refreshToday()">Start today</button>
          <button type="button" class="btn o sm" @click="st.b = refreshToday()">End today</button>
        </div>
        <label class="li tg dtg">
          <div class="grow"><div class="t">Count the end date too</div><div class="s">Monday to Friday is 4 days, or 5 counting both</div></div>
          <input v-model="st.includeEnd" type="checkbox" />
        </label>
      </div>
      <div class="card dcard dres" aria-live="polite">
        <template v-if="between">
          <div class="dtop">
            <div class="dbig num">{{ describeDays(between.days) }}</div>
            <button type="button" class="ib" title="Copy result" aria-label="Copy result" @click="copy(copyText)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div v-if="between.back" class="dnote">The end date is before the start date.</div>
          <div class="li"><span class="grow">Years, months, days</span><span class="dv">{{ between.ymd }}</span></div>
          <div class="li"><span class="grow">Weeks</span><span class="dv">{{ between.weeks }}</span></div>
          <div class="li"><span class="grow">Business days (Mon-Fri)</span><span class="dv num">{{ nf.format(between.work) }}</span></div>
        </template>
        <div v-else class="dnote">Pick both dates.</div>
      </div>
    </div>

    <div v-else-if="st.tab === 'add'" class="dgrid">
      <div class="card dcard">
        <div class="fld">
          <label for="d-s">Date</label>
          <input id="d-s" v-model="st.start" type="date" min="0001-01-01" max="9999-12-31" />
          <div class="dnote">{{ about(S) || "Pick a date" }}</div>
        </div>
        <div class="seg sm dseg2"><button type="button" :class="{ on: !st.sub }" @click="st.sub = false">Add</button><button type="button" :class="{ on: st.sub }" @click="st.sub = true">Subtract</button></div>
        <div class="dparts">
          <div v-for="[k, l] in PARTS" :key="k" class="fld">
            <label :for="'d-' + k">{{ l }}</label>
            <input :id="'d-' + k" v-model="st[k]" class="num" type="text" inputmode="numeric" autocomplete="off" placeholder="0" />
          </div>
        </div>
        <div class="dnote">Years and months are added first, then weeks and days. When the month is shorter, the last day of the month is used: 31 Jan + 1 month is 28 Feb (29 in a leap year).</div>
      </div>
      <div class="card dcard dres" aria-live="polite">
        <template v-if="addedDate">
          <div class="dtop">
            <div class="dbig">{{ long(addedDate) }}</div>
            <button type="button" class="ib" title="Copy result" aria-label="Copy result" @click="copy(copyText)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div class="dnote">{{ about(addedDate) }}</div>
          <div v-if="added && 'clamped' in added && added.clamped" class="dnote dinfo">That month has no day {{ S!.d }}, so its last day was used.</div>
          <div class="li"><span class="grow">Days from {{ short(S!) }}</span><span class="dv num">{{ nf.format(daysBetween(S!, addedDate)) }}</span></div>
        </template>
        <div v-else class="dnote" :class="{ dwarn: added && 'error' in added }">{{ added && "error" in added ? added.error : "Pick a date." }}</div>
      </div>
    </div>

    <div v-else-if="st.tab === 'age'" class="dgrid">
      <div class="card dcard">
        <div class="fld">
          <label for="d-birth">Date of birth</label>
          <input id="d-birth" v-model="st.birth" type="date" min="0001-01-01" max="9999-12-31" />
          <div class="dnote">{{ about(birth) || "Pick a date" }}</div>
        </div>
        <div class="fld">
          <label for="d-on">Age on</label>
          <input id="d-on" v-model="st.on" type="date" min="0001-01-01" max="9999-12-31" />
          <div class="dnote">{{ st.on ? about(onDay) : "Today" }}</div>
        </div>
        <div class="dbtns"><button type="button" class="btn o sm" :disabled="!st.on" @click="st.on = ''">Today</button></div>
      </div>
      <div class="card dcard dres" aria-live="polite">
        <template v-if="ageR">
          <div class="dtop">
            <div class="dbig num">{{ ageR.years === 1 ? "1 year" : `${nf.format(ageR.years)} years` }}</div>
            <button type="button" class="ib" title="Copy result" aria-label="Copy result" @click="copy(copyText)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div class="li"><span class="grow">Exactly</span><span class="dv">{{ ageText }}</span></div>
          <div class="li"><span class="grow">In days</span><span class="dv num">{{ nf.format(ageR.totalDays) }}</span></div>
          <div class="li"><span class="grow">Next birthday</span><span class="dv">{{ long(ageR.nextBirthday) }} · in {{ describeDays(ageR.daysToBirthday) }}</span></div>
          <div v-if="birth!.m === 2 && birth!.d === 29" class="dnote">Born on 29 Feb: in other years the birthday is counted on 1 Mar.</div>
        </template>
        <div v-else class="dnote" :class="{ dwarn: birth && onDay }">{{ birth && onDay ? "The date of birth is after that day." : "Pick a date of birth." }}</div>
      </div>
    </div>

    <div v-else class="dgrid">
      <div class="card dcard">
        <h3 class="dh">From one time to another</h3>
        <div class="dparts two">
          <div class="fld"><label for="d-t1">From</label><input id="d-t1" v-model="st.t1" type="time" /></div>
          <div class="fld"><label for="d-t2">To</label><input id="d-t2" v-model="st.t2" type="time" /></div>
        </div>
        <div v-if="span" class="dtop" aria-live="polite">
          <div class="dbig num">{{ formatDuration(span.seconds) }}</div>
          <button type="button" class="ib" title="Copy result" aria-label="Copy result" @click="copy(formatDuration(span.seconds))">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
          </button>
        </div>
        <div v-if="span" class="dnote">{{ describeDuration(span.seconds) }}{{ span.nextDay ? " · ends the next day" : "" }}</div>
        <div v-else class="dnote">Pick both times.</div>
      </div>
      <div class="card dcard">
        <h3 class="dh">Add and subtract hours</h3>
        <div class="fld">
          <label for="d-durs">Hours and minutes</label>
          <input id="d-durs" v-model="st.durs" class="num" type="text" autocomplete="off" spellcheck="false" inputmode="text" placeholder="1:30 + 2:45 - 0:20" />
          <div class="dnote">hours:minutes, or hours:minutes:seconds, with + or - between them</div>
        </div>
        <template v-if="typeof sum === 'number'">
          <div class="dtop" aria-live="polite">
            <div class="dbig num">{{ formatDuration(sum) }}</div>
            <button type="button" class="ib" title="Copy result" aria-label="Copy result" @click="copy(formatDuration(sum))">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div class="dnote">{{ describeDuration(sum) }}</div>
        </template>
        <div v-else-if="sum" class="dnote dwarn" role="alert">{{ sum.error }}</div>
      </div>
    </div>
  </div>
</template>

<style>
/* Calculator's Date mode. Tokens only, like the rest of the calculator (calc.css). The page grows with its forms
   instead of the keypad's fixed height. */
html.phone .calc.dmode, .calc.dmode { height: auto; min-height: 0; }
html:not(.phone) .calc.dmode { max-width: 900px; }
.dcalc { display: flex; flex-direction: column; gap: var(--spg); }
.dcalc .dseg { margin: 0; }
.dcalc .dseg2 { margin: 0 0 var(--hg); }
.dgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--spg); align-items: start; }
.dcalc.phone .dgrid { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 760px) { .dgrid { grid-template-columns: minmax(0, 1fr); } }
.dcard { display: flex; flex-direction: column; }
.dcard .fld input { width: 100%; font-variant-numeric: tabular-nums; }
.dcard input[type=date], .dcard input[type=time] { color-scheme: inherit; }
.dh { margin: 0 0 var(--hg); font-size: var(--fs); }
.dnote { font-size: var(--fs-sm); color: var(--tx2); margin-top: calc(var(--lpy) * .4); line-height: 1.4; }
.dwarn { color: var(--neg); }
.dinfo { color: var(--tx); font-weight: 600; }
.dbtns { display: flex; flex-wrap: wrap; gap: var(--hg); margin-bottom: var(--hg); }
.dtg { padding-inline: 0; }
.dtg .t { font-size: var(--fs); }
.dtg .s { font-size: var(--fs-xs); color: var(--tx2); }
.dparts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 var(--hg); }
.dparts.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dcalc.phone .dparts:not(.two) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dtop { display: flex; align-items: center; gap: var(--hg); }
.dcalc.phone .dbig { font-size: calc(var(--fs-val) * .85); }
.dbig { flex: 1; min-width: 0; font-size: var(--fs-val); font-weight: 600; line-height: 1.2; color: var(--acc); overflow-wrap: anywhere; user-select: text; }
.dres .li { gap: var(--hg); padding-inline: 0; }
.dres .dtop + .li, .dres .dnote + .li { margin-top: var(--hg); }
.dv { text-align: end; overflow-wrap: anywhere; max-width: 60%; }
</style>
