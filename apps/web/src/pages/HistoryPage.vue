<script setup lang="ts">
// Past calculations, newest first, kept only on this device. Tap the answer to type it into the calculator, or the
// expression to bring the whole sum back. Search, pin (pinned ones sit first and survive the cap and Clear), copy and
// export from the menus.
import { computed, ref } from "vue";
import { history, histPrefs, clearHistory, restoreHistory, togglePin, removeEntry, filterHistory, splitPinned, lineOf, toText, toCsv, type HistItem } from "../core/history";
import { calc, press, show, typedValue, restoreExpr } from "../core/calc";
import { BASES } from "@calc/core";
import { go } from "../shell/nav";
import { toast } from "../core/toast";
import { isAndroid } from "../native/android";
import Menu from "../components/Menu.vue";
import Icon from "../components/Icon.vue";
import Sheet from "../components/Sheet.vue";

const q = ref("");
const shown = computed(() => splitPinned(filterHistory(history, q.value)));
const anyPinned = computed(() => history.some((h) => h.p));
const items = computed(() => [
  { label: "Copy all", run: () => copy(toText(history)), hidden: !history.length },
  { label: "Export as text (.txt)", run: () => exportFile("calculator-history.txt", "text/plain", toText(history)), hidden: !history.length },
  { label: "Export as CSV (.csv)", run: () => exportFile("calculator-history.csv", "text/csv", toCsv(history)), hidden: !history.length },
  { label: "Clear history", icon: "trash", danger: true, sep: true, run: () => (anyPinned.value ? (askClear.value = true) : clear(false)), hidden: !history.length },
  { label: "Clear all including pinned", icon: "trash", danger: true, run: () => clear(false), hidden: !anyPinned.value },
]);
const rowItems = (h: HistItem) => [
  { label: "Copy", run: () => copy(lineOf(h)) },
  { label: h.p ? "Unpin" : "Pin", run: () => togglePin(h) },
  { label: "Delete", icon: "trash", danger: true, run: () => del(h) },
];
const askClear = ref(false);
function clear(keepPinned: boolean) {
  askClear.value = false;
  const old = history.map((h) => ({ ...h }));
  clearHistory(keepPinned);
  toast("History cleared", { action: { label: "Undo", run: () => restoreHistory(old) } });
}
function del(h: HistItem) {
  const old = history.map((x) => ({ ...x }));
  removeEntry(h);
  toast("Deleted", { action: { label: "Undo", run: () => restoreHistory(old) } });
}
async function copy(t: string, msg = "Copied") {
  try { await navigator.clipboard.writeText(t); toast(msg); } catch { toast("Couldn't copy", { kind: "err" }); }
}
// A download made in the page (Blob + link). The Android app's web view doesn't save such downloads, so there the
// history is copied instead; the desktop app (Electron) saves them through its normal save dialog.
function exportFile(name: string, type: string, body: string) {
  if (isAndroid()) return void copy(body, "Copied (downloads aren't available in this app)");
  const url = URL.createObjectURL(new Blob([type === "text/csv" ? "\ufeff" + body : body], { type: type + ";charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported " + name);
}

/** x: the answer in full (exact, so 1/3 used again is still 1/3), r: as shown, for answers too long to have been kept */
function useResult(x: string, r: string) {
  const v = typedValue(x || r);
  if (!v) return; // a fraction can't go into a programming-mode sum (typedValue says so)
  // after an operator or "(" the answer joins the sum being typed, otherwise it starts a new one
  if (calc.answer || calc.error || !/[+−×÷^(]$/.test(calc.expr)) { press("AC"); }
  press("fn:" + v);
  go("calc");
}
// a programming-mode sum comes back in programming mode, with its base, word size and sign
function useExpr(h: HistItem) { restoreExpr(h); go("calc"); }
/** A programming-mode entry is shown as typed, marked with its base (HEX), the answer with it as a subscript (FF₁₆) */
const base = (b?: number) => BASES.find((x) => x.base === b);
const text = (s: string, b?: number, isAnswer = false) => (b ? s.replace(/-/g, "−") + (isAnswer && b !== 10 ? base(b)?.sub ?? "" : "") : show(s));
</script>

<template>
  <div class="page">
    <div class="ph"><div><h1>History</h1></div><div class="acts"><Menu :items="items" label="History options" /></div></div>
    <div v-if="!histPrefs.keep && !history.length" class="card soon"><Icon name="history" :size="32" /><b>History is off</b><span>New calculations aren't saved. Switch it on in Settings, History.</span></div>
    <div v-else-if="!history.length" class="card soon"><Icon name="history" :size="32" /><b>No calculations yet</b><span>Your past sums will be listed here, kept only on this device.</span></div>
    <template v-else>
      <p v-if="!histPrefs.keep" class="hnote">History is off: new calculations aren't saved. Switch it on in Settings, History.</p>
      <input v-model="q" class="hsearch" type="search" placeholder="Search history" aria-label="Search history" autocomplete="off" />
      <div v-if="!shown.pinned.length && !shown.rest.length" class="card soon"><b>No matches</b><span>Nothing in the history matches "{{ q }}".</span></div>
      <template v-for="g in [{ k: 'pin', title: 'Pinned', list: shown.pinned }, { k: 'rest', title: shown.pinned.length ? 'Recent' : '', list: shown.rest }]" :key="g.k">
        <template v-if="g.list.length">
          <div v-if="g.title" class="sh"><h2>{{ g.title }}</h2></div>
          <div class="card flush hlist">
            <div v-for="(h, i) in g.list" :key="h.t + ':' + i" class="li hrow">
              <div class="hmain">
                <button type="button" class="hexp num" title="Use this expression" @click="useExpr(h)"><span v-if="h.b" class="hbase">{{ base(h.b)?.label }}</span>{{ text(h.e, h.b) }}</button>
                <button type="button" class="hres num" :class="{ long: h.r.length > 18 }" title="Use this answer" @click="useResult(h.x, h.r)">=&nbsp;{{ text(h.r, h.b, true) }}</button>
              </div>
              <Menu :items="rowItems(h)" label="Entry options" />
            </div>
          </div>
        </template>
      </template>
    </template>
    <Sheet v-if="askClear" title="Clear history" @close="askClear = false">
      <p>Some entries are pinned. Keep them?</p>
      <div class="hbtns"><button type="button" class="btn" @click="clear(true)">Keep pinned</button><button type="button" class="btn o" @click="clear(false)">Clear all including pinned</button></div>
    </Sheet>
  </div>
</template>

<style scoped>
.hrow { flex-direction: row; align-items: center; gap: var(--hg); }
.hmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: calc(var(--lpy) / 4); }
.hmain button { border: 0; background: none; padding: calc(var(--lpy) / 4) 0; font-family: inherit; text-align: end; cursor: pointer; overflow-wrap: anywhere; border-radius: var(--r-sm); }
.hsearch { width: 100%; margin-bottom: var(--hg); }
.hnote { color: var(--tx2); margin-bottom: var(--hg); }
.hbtns { display: flex; flex-wrap: wrap; gap: var(--hg); margin-top: var(--hg); }
</style>
