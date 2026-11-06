<script setup lang="ts">
// Past calculations, newest first, kept only on this device. Tap the answer to type it into the calculator, or the
// expression to bring the whole sum back; ⋮ clears the list.
import { computed } from "vue";
import { history, clearHistory, restoreHistory } from "../core/history";
import { calc, press, show, typedValue, prog } from "../core/calc";
import { BASES, type Base } from "@calc/core";
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
  // after an operator or "(" the answer joins the sum being typed, otherwise it starts a new one
  if (calc.answer || calc.error || !/[+−×÷^(]$/.test(calc.expr)) { press("AC"); }
  press("fn:" + typedValue(x || r));
  go("calc");
}
// a programming-mode sum comes back in programming mode, in its base (its digits mean nothing in another)
function useExpr(e: string, b?: number) {
  if (b) { calc.mode = "programming"; prog.base = b as Base; }
  press("AC"); calc.expr = e; go("calc");
}
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
        <button type="button" class="hexp num" title="Use this expression" @click="useExpr(h.e, h.b)"><span v-if="h.b" class="hbase">{{ base(h.b)?.label }}</span>{{ text(h.e, h.b) }}</button>
        <button type="button" class="hres num" :class="{ long: h.r.length > 18 }" title="Use this answer" @click="useResult(h.x, h.r)">=&nbsp;{{ text(h.r, h.b, true) }}</button>
      </div>
    </div>
  </div>
</template>
