<script setup lang="ts">
// Past calculations, newest first, kept only on this device. Tap the answer to type it into the calculator, or the
// expression to bring the whole sum back; ⋮ clears the list.
import { computed } from "vue";
import { history, clearHistory, restoreHistory, type HistItem } from "../core/history";
import { calc, press, show, typedValue, restoreExpr } from "../core/calc";
import { BASES } from "@calc/core";
import { go } from "../shell/nav";
import { toast } from "../core/toast";
import Menu from "../components/Menu.vue";
import Icon from "../components/Icon.vue";

const items = computed(() => [{ label: "Clear history", icon: "trash", danger: true, run: clear, hidden: !history.length }]);
function clear() {
  const old = history.slice();
  clearHistory();
  toast("History cleared", { action: { label: "Undo", run: () => restoreHistory(old) } });
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
    <div v-if="!history.length" class="card soon"><Icon name="history" :size="32" /><b>No calculations yet</b><span>Your past sums will be listed here, kept only on this device.</span></div>
    <div v-else class="card flush hlist">
      <div v-for="(h, i) in history" :key="h.t + ':' + i" class="li hrow">
        <button type="button" class="hexp num" title="Use this expression" @click="useExpr(h)"><span v-if="h.b" class="hbase">{{ base(h.b)?.label }}</span>{{ text(h.e, h.b) }}</button>
        <button type="button" class="hres num" :class="{ long: h.r.length > 18 }" title="Use this answer" @click="useResult(h.x, h.r)">=&nbsp;{{ text(h.r, h.b, true) }}</button>
      </div>
    </div>
  </div>
</template>
