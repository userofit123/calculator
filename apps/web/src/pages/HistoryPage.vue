<script setup lang="ts">
// Past calculations, newest first, kept only on this device. Tap the answer to type it into the calculator, or the
// expression to bring the whole sum back; ⋮ clears the list.
import { computed } from "vue";
import { history, clearHistory, restoreHistory } from "../core/history";
import { calc, press, show } from "../core/calc";
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

function useResult(r: string) {
  // after an operator or "(" the answer joins the sum being typed, otherwise it starts a new one
  if (calc.answer || calc.error || !/[+−×÷^(]$/.test(calc.expr)) { press("AC"); }
  press("fn:" + r.replace(/^-/, "−"));
  go("calc");
}
function useExpr(e: string) { press("AC"); calc.expr = e; go("calc"); }
</script>

<template>
  <div class="page">
    <div class="ph"><div><h1>History</h1></div><div class="acts"><Menu :items="items" label="History options" /></div></div>
    <div v-if="!history.length" class="card soon"><Icon name="history" :size="32" /><b>No calculations yet</b><span>Your past sums will be listed here, kept only on this device.</span></div>
    <div v-else class="card flush hlist">
      <div v-for="(h, i) in history" :key="h.t + ':' + i" class="li hrow">
        <button type="button" class="hexp num" title="Use this expression" @click="useExpr(h.e)">{{ show(h.e) }}</button>
        <button type="button" class="hres num" :class="{ long: h.r.length > 18 }" title="Use this answer" @click="useResult(h.r)">=&nbsp;{{ show(h.r) }}</button>
      </div>
    </div>
  </div>
</template>
