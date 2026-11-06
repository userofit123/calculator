<script setup lang="ts">
// The first screen: the mode switch, the display (what is typed above, the answer or a live preview below), memory keys
// and the keypad; Advanced adds a function pad (with a 2nd layer for inverse functions, so it fits a phone). Full
// keyboard support on a computer, including typing a free expression (sin(30)+2^10, x = 5), copy and paste.
// Programming has its own keys, bases and bit view (ProgPad, loaded only when that mode is chosen).
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { calc, press, preview, keyFor, paste, showCalc as show, current, settings, MODES, ANGLES } from "../core/calc";
import { isPhone } from "../core/device";
import { toast } from "../core/toast";
import Menu from "../components/Menu.vue";
import Icon from "../components/Icon.vue";

const VariablesSheet = defineAsyncComponent(() => import("../components/VariablesSheet.vue"));
const varsOpen = ref(false);
const ProgPad = defineAsyncComponent(() => import("../components/ProgPad.vue"));

// kind: n = number, op = operator (accent tint), fn = function (quiet), eq = the one filled key
type Kind = "n" | "op" | "fn" | "eq";
const clearKey = computed(() => {
  const n = progMode.value ? /[\dA-F]$/ : /[\d.]$/, other = progMode.value ? /[^\dA-F]/ : /[^\d.]/;
  return !calc.answer && !calc.error && n.test(calc.expr) && other.test(calc.expr) ? "C" : "AC";
});
const KEYS = computed<{ k: string; label?: string; kind: Kind; aria?: string }[]>(() => [
  { k: clearKey.value, kind: "fn", aria: clearKey.value === "C" ? "Clear number" : "Clear all" }, { k: "()", label: "( )", kind: "fn", aria: "Brackets" }, { k: "%", kind: "fn", aria: "Percent" }, { k: "÷", kind: "op", aria: "Divide" },
  { k: "7", kind: "n" }, { k: "8", kind: "n" }, { k: "9", kind: "n" }, { k: "×", kind: "op", aria: "Multiply" },
  { k: "4", kind: "n" }, { k: "5", kind: "n" }, { k: "6", kind: "n" }, { k: "−", kind: "op", aria: "Minus" },
  { k: "1", kind: "n" }, { k: "2", kind: "n" }, { k: "3", kind: "n" }, { k: "+", kind: "op", aria: "Plus" },
  { k: "±", kind: "n", aria: "Change sign" }, { k: "0", kind: "n" }, { k: ".", label: settings.decimalMark, kind: "n", aria: "Decimal point" }, { k: "=", kind: "eq", aria: "Equals" },
]);
const MEM = [{ k: "MC", aria: "Clear memory" }, { k: "MR", aria: "Recall memory" }, { k: "M+", aria: "Add to memory" }, { k: "M−", aria: "Subtract from memory" }];

// The function pad: label and key on the normal layer, and on the 2nd layer (inverse functions) where different.
// Trig keys also follow hyp. The 5×4 grid is the same on the phone and a computer.
interface FKey { k: string; label: string; aria: string; k2?: string; label2?: string; aria2?: string; on?: boolean }
const trig = (f: string): FKey => {
  const h = calc.hyp ? "h" : "";
  return { k: `fn:${calc.second ? "a" : ""}${f}${h}(`, label: `${f}${h}${calc.second ? "⁻¹" : ""}`, aria: `${calc.second ? "Inverse " : ""}${calc.hyp ? "hyperbolic " : ""}${f}` };
};
const angleLabel = computed(() => ANGLES.find((a) => a.id === settings.angle)!.label);
const FKEYS = computed<FKey[]>(() => [
  { k: "2nd", label: "2nd", aria: "Second functions", on: calc.second }, { k: "hyp", label: "hyp", aria: "Hyperbolic", on: calc.hyp },
  { k: "angle", label: angleLabel.value, aria: "Angle unit" }, { k: "(", label: "(", aria: "Open bracket" }, { k: ")", label: ")", aria: "Close bracket" },
  trig("sin"), trig("cos"), trig("tan"),
  { k: "fn:ln(", label: "ln", aria: "Natural logarithm", k2: "fn:e^", label2: "eˣ", aria2: "e to the power" },
  { k: "fn:log(", label: "log", aria: "Logarithm", k2: "fn:10^", label2: "10ˣ", aria2: "10 to the power" },
  { k: "op:²", label: "x²", aria: "Square", k2: "op:³", label2: "x³", aria2: "Cube" },
  { k: "op:^", label: "xʸ", aria: "Power", k2: "nroot", label2: "ⁿ√x", aria2: "Nth root" },
  { k: "fn:√", label: "√x", aria: "Square root", k2: "fn:∛", label2: "∛x", aria2: "Cube root" },
  { k: "op:⁻¹", label: "x⁻¹", aria: "Reciprocal" },
  { k: "fn:π", label: "π", aria: "Pi", k2: "fn:e", label2: "e", aria2: "e" },
  { k: "!", label: "n!", aria: "Factorial" }, { k: "op: mod ", label: "mod", aria: "Modulo" }, { k: "fn:abs(", label: "|x|", aria: "Absolute value" },
  { k: "fn:ans", label: "ans", aria: "Last answer" }, { k: "op:×10^", label: "×10ʸ", aria: "Times ten to the power (Ctrl+E)" },
].map((f: FKey) => (calc.second && f.k2 ? { ...f, k: f.k2, label: f.label2!, aria: f.aria2! } : f)));
function fkey(k: string) {
  if (k === "2nd") { calc.second = !calc.second; return; }
  if (k === "hyp") { calc.hyp = !calc.hyp; return; }
  if (k === "angle") { const i = ANGLES.findIndex((a) => a.id === settings.angle); settings.angle = ANGLES[(i + 1) % ANGLES.length]!.id; return; }
  tap(k);
}

const modeItems = computed(() => MODES.map((m) => ({ label: m.label, hint: m.hint, checked: calc.mode === m.id, run: () => { calc.mode = m.id; } })));
const modeLabel = computed(() => MODES.find((m) => m.id === calc.mode)?.label ?? "Basic");
const adv = computed(() => calc.mode === "advanced");
const progMode = computed(() => calc.mode === "programming");

const pv = computed(preview);
const big = computed(() => calc.error || show(calc.answer || pv.value) || (calc.expr ? "" : "0"));
// long answers get smaller instead of running off the edge
const size = computed(() => { const n = big.value.length; return n > 18 ? "xs" : n > 13 ? "s" : n > 9 ? "m" : ""; });

// the end of a long expression stays in view
const exprEl = ref<HTMLElement | null>(null);
watch(() => calc.expr, () => nextTick(() => { if (exprEl.value) exprEl.value.scrollLeft = exprEl.value.scrollWidth; }));

// the key on screen lights up for a keyboard press too
const hit = ref("");
let hitT: ReturnType<typeof setTimeout> | undefined;
function tap(k: string) {
  press(k);
  hit.value = k; clearTimeout(hitT); hitT = setTimeout(() => (hit.value = ""), 140);
}
const busy = (e: Event) => !!(e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || !!document.querySelector(".scr, #pop.on");
// Space would press the calculator key last clicked again (it keeps the focus), so on the keys it does nothing; browsers
// press a button on keydown (Chromium) or keyup (Firefox), so both are stopped
const onPadKey = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest?.(".cpad, .memk, .ppanel, .pbar");
const onKeyUp = (e: KeyboardEvent) => { if (e.key === " " && onPadKey(e)) e.preventDefault(); };
function onKey(e: KeyboardEvent) {
  if (busy(e)) return;
  if (e.key === " " && !e.ctrlKey) { if (onPadKey(e)) e.preventDefault(); return; }
  let k = keyFor(e); // with Ctrl only Ctrl+E (×10ʸ): Ctrl+C, Ctrl+V and the browser's own shortcuts are left alone
  if (!k) return;
  if (k === "C") k = clearKey.value; // Delete clears the number being typed, or everything when that is all there is
  e.preventDefault();
  tap(k);
}
// Ctrl+C with nothing selected copies the answer; Ctrl+V types the clipboard in (cleaned up)
const copyText = () => { const c = current(); return c ? formatCopy(c.value) : ""; };
const formatCopy = (v: string) => (settings.decimalMark === "," ? v.replace(/\./g, ",") : v);
function onCopy(e: ClipboardEvent) {
  if (busy(e) || getSelection()?.toString()) return;
  const t = copyText();
  if (!t) return;
  e.preventDefault(); e.clipboardData?.setData("text/plain", t); toast("Copied");
}
function onPaste(e: ClipboardEvent) {
  if (busy(e)) return;
  const t = e.clipboardData?.getData("text/plain");
  if (!t) return;
  e.preventDefault(); paste(t);
}
onMounted(() => { addEventListener("keydown", onKey); addEventListener("keyup", onKeyUp); document.addEventListener("copy", onCopy); document.addEventListener("paste", onPaste); });
onBeforeUnmount(() => { removeEventListener("keydown", onKey); removeEventListener("keyup", onKeyUp); document.removeEventListener("copy", onCopy); document.removeEventListener("paste", onPaste); });

async function copyAnswer() {
  const t = copyText();
  if (!t) return;
  try { await navigator.clipboard.writeText(t); toast("Copied"); } catch { /* the clipboard isn't available here */ }
}
</script>

<template>
  <div class="page calc" :class="{ phone: isPhone, adv, prog: progMode }">
    <div class="calc-top">
      <Menu :items="modeItems" :text="modeLabel" label="Calculator mode" align="start" />
      <button v-if="adv" type="button" class="cvars" @click="varsOpen = true">Variables</button>
    </div>
    <div class="cdisp" aria-live="polite">
      <div class="cbar">
        <button v-if="adv" type="button" class="cflag" title="Angle unit" @click="fkey('angle')">{{ angleLabel }}</button>
        <span v-if="calc.mem" class="cflag" title="Memory in use">M</span>
        <span class="grow" />
        <button type="button" class="ib sm plain" aria-label="Delete" :disabled="!calc.expr" @click="tap('⌫')"><Icon name="backspace" /></button>
      </div>
      <div ref="exprEl" class="cexp num" :title="show(calc.expr)">{{ show(calc.expr) }}<span v-if="calc.answer" class="ceq"> =</span></div>
      <button type="button" class="cres num" :class="[size, { pre: !calc.answer && !calc.error && !!pv, err: !!calc.error }]" title="Copy" @click="copyAnswer">{{ big }}</button>
    </div>
    <div v-if="calc.mode === 'financial'" class="cnote sm"><Icon name="info" :size="16" />{{ modeLabel }} keys are coming next. The basic keys work meanwhile.</div>
    <ProgPad v-if="progMode" :hit="hit" :clear="clearKey" @tap="tap" />
    <div v-else class="cpad">
      <div v-if="adv" class="fkeys" role="group" aria-label="Functions">
        <button v-for="f in FKEYS" :key="f.aria" type="button" class="key k-fn" :class="{ on: f.on, hit: hit === f.k }" :aria-label="f.aria" :aria-pressed="f.on ?? undefined" @click="fkey(f.k)">{{ f.label }}</button>
      </div>
      <div class="bpad">
        <div class="memk" role="group" aria-label="Memory">
          <button v-for="m in MEM" :key="m.k" type="button" :class="{ hit: hit === m.k }" :aria-label="m.aria" :disabled="(m.k === 'MC' || m.k === 'MR') && !calc.mem" @click="tap(m.k)">{{ m.k }}</button>
        </div>
        <div class="keys" role="group" aria-label="Keypad">
          <button v-for="b in KEYS" :key="b.k" type="button" class="key" :class="['k-' + b.kind, { hit: hit === b.k }]" :aria-label="b.aria" @click="tap(b.k)">{{ b.label ?? b.k }}</button>
        </div>
      </div>
    </div>
    <VariablesSheet v-if="varsOpen" @close="varsOpen = false" />
  </div>
</template>
