<script setup lang="ts">
// The first screen: the mode switch, the display (what is typed above, the answer below) and the keypad. Only the
// basic keypad exists so far; the other modes' keys come with their units. Full keyboard support on a computer.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { calc, press, preview, keyFor, MODES } from "../core/calc";
import { isPhone } from "../core/device";
import { toast } from "../core/toast";
import Menu from "../components/Menu.vue";
import Icon from "../components/Icon.vue";

// kind: n = number, op = operator (accent tint), fn = function (quiet), eq = the one filled key
const KEYS: { k: string; label?: string; kind: "n" | "op" | "fn" | "eq"; aria?: string }[] = [
  { k: "AC", kind: "fn", aria: "Clear" }, { k: "()", label: "( )", kind: "fn", aria: "Brackets" }, { k: "⌫", kind: "fn", aria: "Delete" }, { k: "÷", kind: "op", aria: "Divide" },
  { k: "7", kind: "n" }, { k: "8", kind: "n" }, { k: "9", kind: "n" }, { k: "×", kind: "op", aria: "Multiply" },
  { k: "4", kind: "n" }, { k: "5", kind: "n" }, { k: "6", kind: "n" }, { k: "−", kind: "op", aria: "Minus" },
  { k: "1", kind: "n" }, { k: "2", kind: "n" }, { k: "3", kind: "n" }, { k: "+", kind: "op", aria: "Plus" },
  { k: "±", kind: "n", aria: "Change sign" }, { k: "0", kind: "n" }, { k: ".", kind: "n", aria: "Decimal point" }, { k: "=", kind: "eq", aria: "Equals" },
];
const modeItems = computed(() => MODES.map((m) => ({ label: m.label, hint: m.hint, checked: calc.mode === m.id, run: () => { calc.mode = m.id; } })));
const modeLabel = computed(() => MODES.find((m) => m.id === calc.mode)?.label ?? "Basic");

const pv = computed(preview);
const big = computed(() => calc.error || calc.answer || pv.value || (calc.expr ? "" : "0"));
// long answers get smaller instead of running off the edge
const size = computed(() => { const n = big.value.length; return n > 18 ? "xs" : n > 13 ? "s" : n > 9 ? "m" : ""; });

// the key on screen lights up for a keyboard press too
const hit = ref("");
let hitT: ReturnType<typeof setTimeout> | undefined;
function tap(k: string) {
  press(k);
  hit.value = k; clearTimeout(hitT); hitT = setTimeout(() => (hit.value = ""), 140);
}
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || document.querySelector(".scr, #pop.on")) return;
  const k = keyFor(e);
  if (!k) return;
  e.preventDefault();
  tap(k);
}
onMounted(() => addEventListener("keydown", onKey));
onBeforeUnmount(() => removeEventListener("keydown", onKey));

async function copyAnswer() {
  const v = calc.answer || pv.value;
  if (!v) return;
  try { await navigator.clipboard.writeText(v); toast("Copied"); } catch { /* the clipboard isn't available here */ }
}
</script>

<template>
  <div class="page calc" :class="{ phone: isPhone }">
    <div class="calc-top">
      <Menu :items="modeItems" :text="modeLabel" label="Calculator mode" align="start" />
    </div>
    <div class="cdisp" aria-live="polite">
      <div class="cexp num" :title="calc.expr">{{ calc.expr }}<span v-if="calc.answer" class="ceq"> =</span></div>
      <button type="button" class="cres num" :class="[size, { pre: !calc.answer && !calc.error && !!pv, err: !!calc.error }]" title="Copy" @click="copyAnswer">{{ big }}</button>
    </div>
    <div v-if="calc.mode !== 'basic'" class="cnote sm"><Icon name="info" :size="16" />{{ modeLabel }} keys are coming next. The basic keys work meanwhile.</div>
    <div class="keys" role="group" aria-label="Keypad">
      <button v-for="b in KEYS" :key="b.k" type="button" class="key" :class="['k-' + b.kind, { hit: hit === b.k }]" :aria-label="b.aria" @click="tap(b.k)">
        <Icon v-if="b.k === '⌫'" name="backspace" :size="24" /><template v-else>{{ b.label ?? b.k }}</template>
      </button>
    </div>
  </div>
</template>
