<script setup lang="ts">
// The first screen: the mode switch, the display (what is typed above, the answer or a live preview below), memory keys
// and the keypad; Advanced adds a function pad (with a 2nd layer for inverse functions, so it fits a phone). Full
// keyboard support on a computer, including typing a free expression (sin(30)+2^10, x = 5), copy and paste.
// Financial adds GNOME's ten financial functions above the basic keys, each with a form (FinPad, loaded when chosen).
// Programming has its own keys, bases and bit view (ProgPad: small, so in the main bundle, and a calculator last left in
// programming mode opens on its own keys at once instead of waiting for a chunk to load).
// Keyboard has no keys: earlier lines above one line to type whole sums in (KeyboardCalc: small, in the main bundle, as
// a computer's first open starts in it).
// Date has no display or keys: its forms (DateCalc, loaded when chosen) take their place, under the same mode switch.
// Percent, Discount (PercentCalc) and Tip & Split (TipCalc) are forms the same way, loaded when chosen.
// C-66: the top is a row of tabs. The first is the calculator, named after its type, with the types (Basic, Advanced,
// Financial, Programming, Keyboard) in its menu; the tools (Tip & Split, Discount, Percent, Date) are a tab each.
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { calc, press, preview, keyFor, paste, showCalc as show, current, settings, MODES, CALC_TYPES, TOOLS, lastType, ANGLES, chooseStartMode, formMode, answerNote, withUnit, modeLabel as modeName, modeHint } from "../core/calc";
import { t, type Key } from "../core/i18n";
import { tMsg } from "../core/msg";
import { isPhone } from "../core/device";
import { toast } from "../core/toast";
import Menu from "../components/Menu.vue";
import Icon from "../components/Icon.vue";
import ProgPad from "../components/ProgPad.vue";
import KeyboardCalc from "../components/KeyboardCalc.vue";
import NumFormat from "../components/NumFormat.vue";
import { speak } from "../core/speak";
import { play, flipChanged, vSwap } from "../core/motion";

// a first-ever open picks its mode before the first paint: Keyboard on a computer with no touch screen, else Basic
chooseStartMode(isPhone.value);

const VariablesSheet = defineAsyncComponent(() => import("../components/VariablesSheet.vue"));
const varsOpen = ref(false);
const FinPad = defineAsyncComponent(() => import("../components/FinPad.vue"));
const DateCalc = defineAsyncComponent(() => import("../components/DateCalc.vue"));
const TipCalc = defineAsyncComponent(() => import("../components/TipCalc.vue"));
const PercentCalc = defineAsyncComponent(() => import("../components/PercentCalc.vue"));

// kind: n = number, op = operator (accent tint), fn = function (quiet), eq = the one filled key
type Kind = "n" | "op" | "fn" | "eq";
const clearKey = computed(() => {
  const n = progMode.value ? /[\dA-F]$/ : /[\d.]$/, other = progMode.value ? /[^\dA-F]/ : /[^\d.]/;
  return !calc.answer && !calc.error && n.test(calc.expr) && other.test(calc.expr) ? "C" : "AC";
});
const KEYS = computed<{ k: string; label?: string; kind: Kind; aria?: string }[]>(() => [
  { k: clearKey.value, kind: "fn", aria: t(clearKey.value === "C" ? "key.clearNumber" : "key.clearAll") }, { k: "()", label: "( )", kind: "fn", aria: t("key.brackets") }, { k: "%", kind: "fn", aria: t("key.percent") }, { k: "÷", kind: "op", aria: t("key.divide") },
  { k: "7", kind: "n" }, { k: "8", kind: "n" }, { k: "9", kind: "n" }, { k: "×", kind: "op", aria: t("key.multiply") },
  { k: "4", kind: "n" }, { k: "5", kind: "n" }, { k: "6", kind: "n" }, { k: "−", kind: "op", aria: t("key.minus") },
  { k: "1", kind: "n" }, { k: "2", kind: "n" }, { k: "3", kind: "n" }, { k: "+", kind: "op", aria: t("key.plus") },
  { k: "±", kind: "n", aria: t("key.sign") }, { k: "0", kind: "n" }, { k: ".", label: settings.decimalMark, kind: "n", aria: t("key.point") }, { k: "=", kind: "eq", aria: t("key.equals") },
]);
const MEM = computed(() => [{ k: "MC", aria: t("key.mc") }, { k: "MR", aria: t("key.mr") }, { k: "M+", aria: t("key.mplus") }, { k: "M−", aria: t("key.mminus") }]);

// The function pad: label and key on the normal layer, and on the 2nd layer (inverse functions) where different.
// Trig keys also follow hyp. The 5×4 grid is the same on the phone and a computer.
interface FKey { k: string; label: string; aria: string; k2?: string; label2?: string; aria2?: string; on?: boolean }
// the spoken name: "Inverse hyperbolic sine" (key.trig.* texts, one per combination, so each language words it its own way)
const trig = (f: string): FKey => {
  const h = calc.hyp ? "h" : "";
  return { k: `fn:${calc.second ? "a" : ""}${f}${h}(`, label: `${f}${h}${calc.second ? "⁻¹" : ""}`, aria: t(`key.trig.${calc.second ? "a" : ""}${f}${h}` as Key) };
};
const angleLabel = computed(() => ANGLES.find((a) => a.id === settings.angle)!.label);
// the angle chip and key say what they switch to: "Degrees. Switch to radians"
const angleAria = computed(() => {
  const i = ANGLES.findIndex((a) => a.id === settings.angle), next = ANGLES[(i + 1) % ANGLES.length]!.id;
  return t("key.angle", { now: t(`angle.${settings.angle}` as Key), next: t(`angle.${next}` as Key) });
});
const FKEYS = computed<FKey[]>(() => [
  { k: "2nd", label: "2nd", aria: t("key.second"), on: calc.second }, { k: "hyp", label: "hyp", aria: t("key.hyp"), on: calc.hyp },
  { k: "angle", label: angleLabel.value, aria: angleAria.value }, { k: "(", label: "(", aria: t("key.open") }, { k: ")", label: ")", aria: t("key.close") },
  trig("sin"), trig("cos"), trig("tan"),
  { k: "fn:ln(", label: "ln", aria: t("key.ln"), k2: "fn:e^", label2: "eˣ", aria2: t("key.exp") },
  { k: "fn:log(", label: "log", aria: t("key.log"), k2: "fn:10^", label2: "10ˣ", aria2: t("key.tenPow") },
  { k: "op:²", label: "x²", aria: t("key.square"), k2: "op:³", label2: "x³", aria2: t("key.cube") },
  { k: "op:^", label: "xʸ", aria: t("key.power"), k2: "nroot", label2: "ⁿ√x", aria2: t("key.nroot") },
  { k: "fn:√", label: "√x", aria: t("key.sqrt"), k2: "fn:∛", label2: "∛x", aria2: t("key.cbrt") },
  { k: "op:⁻¹", label: "x⁻¹", aria: t("key.recip") },
  { k: "fn:π", label: "π", aria: t("key.pi"), k2: "fn:e", label2: "e", aria2: t("key.e") },
  { k: "!", label: "n!", aria: t("key.fact") }, { k: "op: mod ", label: "mod", aria: t("key.mod") }, { k: "fn:abs(", label: "|x|", aria: t("key.abs") },
  { k: "fn:ans", label: "ans", aria: t("key.ans") }, { k: "op:×10^", label: "×10ʸ", aria: t("key.ee") },
].map((f: FKey) => (calc.second && f.k2 ? { ...f, k: f.k2, label: f.label2!, aria: f.aria2! } : f)));
function fkey(k: string) {
  if (k === "2nd") { calc.second = !calc.second; return; }
  if (k === "hyp") { calc.hyp = !calc.hyp; return; }
  if (k === "angle") { const i = ANGLES.findIndex((a) => a.id === settings.angle); settings.angle = ANGLES[(i + 1) % ANGLES.length]!.id; return; }
  tap(k);
}

const modeItems = computed(() => CALC_TYPES.map((m) => ({ label: modeName(m.id), hint: modeHint(m.id), checked: lastType.value === m.id, run: () => { calc.mode = m.id; } })));
const typeLabel = computed(() => modeName(lastType.value));
const adv = computed(() => calc.mode === "advanced");
const progMode = computed(() => calc.mode === "programming");
const fin = computed(() => calc.mode === "financial");
const dateMode = computed(() => formMode(calc.mode));
const kbd = computed(() => calc.mode === "keyboard");

// (a preview can be the core's "Number is too large": shown in the language shown)
const pv = computed(() => tMsg(preview()));
/** why the answer is a decimal although Fraction or Mixed is chosen */
// (and for a currency conversion, where its rate came from and for which day)
const note = computed(() => (calc.answer && !calc.error && !progMode.value ? [answerNote(calc.ans), calc.note].filter(Boolean).join(" · ") : ""));
// A lone number being typed (no operator yet) is shown big on the answer's line, like most calculators, and = then
// puts its answer in the same place at the same size; the line above stays empty until there is a sum to show.
// (It has no preview of its own: what = would give is the number itself.)
// (the sign is "−" as typed, or "-" in a Programming sum rebuilt from a negative value)
const typing = computed(() => !calc.answer && !calc.error && (progMode.value ? /^[−-]?[\dA-F]+$/ : /^[−-]?[\d.]+$/).test(calc.expr));
// a preview (faint) is shown while a sum is typed: what = would give now
const previewing = computed(() => !calc.answer && !calc.error && !typing.value && !!pv.value);
// a unit conversion's answer shows its unit after the number: "8.04672 km"
const big = computed(() => calc.error || show(calc.answer ? withUnit(calc.answer, calc.unit) : typing.value ? calc.expr : pv.value) || (calc.expr ? "" : "0"));
// long answers get smaller instead of running off the edge (the line's height stays the same, see .cres in calc.css)
const size = computed(() => { const n = big.value.length; return n > 18 ? "xs" : n > 13 ? "s" : n > 9 ? "m" : ""; });

// For a screen reader: the sum in words, and the answer (or error) announced once = is pressed, not every key's preview.
// The same answer twice in a row is announced again (the region is emptied first).
const said = computed(() => speak(show(calc.expr)));
const bigSaid = computed(() => (calc.error ? tMsg(calc.error) : speak(big.value)));
// the error in the language shown (the core keeps it in English)
const bigShown = computed(() => (calc.error ? tMsg(calc.error) : big.value));
const announce = ref("");
watch(() => [calc.answer, calc.error, calc.unit] as const, ([a, e]) => {
  announce.value = "";
  if (kbd.value || !a && !e) return; // Keyboard mode announces its own answers (KeyboardCalc); Date / Percent / Discount / Tip & Split forms are separate, their cards are live regions
  const said = e ? t("calc.sayError", { e: tMsg(e) }) : t("calc.sayEquals", { x: speak(show(withUnit(a, calc.unit))) });
  setTimeout(() => { announce.value = said; }, 60);
});

// Motion (core/motion.ts): played after the change is on screen, so nothing ever waits for it.
// Another mode: its keys (or forms) come in from the side that mode is on in the mode list.
const pageEl = ref<HTMLElement | null>(null), resEl = ref<HTMLElement | null>(null);
watch(() => calc.mode, (to, from) => {
  const by = MODES.findIndex((m) => m.id === to) >= MODES.findIndex((m) => m.id === from) ? 1 : -1;
  nextTick(() => pageEl.value?.querySelectorAll(":scope > :not(.calc-top, .sr, .scr), .calc-top .pbar").forEach((e) => play(e, "slide", by)));
});
// a tab chosen while scrolled out of a narrow row (or open on start) is brought into view
const showTab = () => pageEl.value?.querySelector(".ctab.on, .ctabs .mnub:not(.off)")?.scrollIntoView({ block: "nearest", inline: "nearest" });
watch(() => calc.mode, () => nextTick(showTab));
onMounted(showTab);
// 2nd, hyp and the angle unit: the keys that now say something else turn over
watch(() => [calc.second, calc.hyp, settings.angle], () => flipChanged(".calc .fkeys .key", nextTick));
// =: the answer comes up into place; a preview (nothing shown before) fades in; an error shakes
watch(() => [calc.answer, calc.error] as const, ([a, e], [a0, e0]) => {
  if (e && e !== e0) play(resEl.value, "shake");
  else if (a && a !== a0) { play(resEl.value, "rise"); play(exprEl.value, "fade"); }
}, { flush: "post" });
watch(previewing, (on) => { if (on) play(resEl.value, "fade"); }, { flush: "post" });

// one still too wide for the line (a long number on a narrow phone) shrinks further to fit, instead of scrolling
function fit() {
  const el = resEl.value;
  if (!el) return;
  el.style.fontSize = "";
  const over = el.scrollWidth / el.clientWidth;
  if (over > 1) el.style.fontSize = `${Math.max(parseFloat(getComputedStyle(el).fontSize) / over - 0.5, 12)}px`;
}
watch(() => [big.value, calc.mode, isPhone.value], () => nextTick(fit), { flush: "post" });
// re-fit whenever the line's width changes, not only the window's (a panel opening beside it, the layout switching).
// Only a width change counts: fit() changes the font size, which must not set it off again
let fitW = 0;
const fitObs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(([e]) => {
  const w = e?.contentRect.width ?? 0;
  if (w !== fitW) { fitW = w; fit(); }
});
watch(resEl, (el, old) => { if (old) fitObs?.unobserve(old); if (el) fitObs?.observe(el); }, { flush: "post" });
onMounted(fit);
onBeforeUnmount(() => fitObs?.disconnect());

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
  if (busy(e) || dateMode.value || kbd.value) return; // Keyboard mode's line takes the keys (KeyboardCalc)
  // Enter on a focused tab chooses it or opens the type menu (it would otherwise be =)
  if (e.key === "Enter" && (e.target as HTMLElement).closest?.(".ctabs")) return;
  if (e.key === " " && !e.ctrlKey) {
    // on the keys, or with nothing focused, Space after a word types one (5km in mi); otherwise it is left alone
    if (onPadKey(e) || e.target === document.body) { e.preventDefault(); press(" "); }
    return;
  }
  let k = keyFor(e); // with Ctrl only Ctrl+E (×10ʸ): Ctrl+C, Ctrl+V and the browser's own shortcuts are left alone
  if (!k) return;
  if (k === "C") k = clearKey.value; // Delete clears the number being typed, or everything when that is all there is
  e.preventDefault();
  tap(k);
}
// Ctrl+C with nothing selected copies the answer; Ctrl+V types the clipboard in (cleaned up). A unit conversion's answer
// is copied as the number alone (8.04672, not "8.04672 km"), so it pastes into another sum or a spreadsheet as a number.
const copyText = () => { const c = current(); return c ? formatCopy(c.value) : ""; };
const formatCopy = (v: string) => (settings.decimalMark === "," ? v.replace(/\./g, ",") : v);
function onCopy(e: ClipboardEvent) {
  if (busy(e) || dateMode.value || getSelection()?.toString()) return;
  const txt = copyText();
  if (!txt) return;
  e.preventDefault(); e.clipboardData?.setData("text/plain", txt); toast(t("c.copied")); play(resEl.value, "pulse");
}
function onPaste(e: ClipboardEvent) {
  if (busy(e) || dateMode.value || kbd.value) return;
  const txt = e.clipboardData?.getData("text/plain");
  if (!txt) return;
  e.preventDefault(); paste(txt);
}
onMounted(() => { addEventListener("keydown", onKey); addEventListener("keyup", onKeyUp); document.addEventListener("copy", onCopy); document.addEventListener("paste", onPaste); });
onBeforeUnmount(() => { removeEventListener("keydown", onKey); removeEventListener("keyup", onKeyUp); document.removeEventListener("copy", onCopy); document.removeEventListener("paste", onPaste); });

async function copyAnswer() {
  const txt = copyText();
  if (!txt) return;
  try { await navigator.clipboard.writeText(txt); toast(t("c.copied")); play(resEl.value, "pulse"); } catch { /* the clipboard isn't available here */ }
}
</script>

<template>
  <div ref="pageEl" class="page calc" :class="{ phone: isPhone, adv, prog: progMode, fin, dmode: dateMode, kbd }">
    <h1 class="sr">{{ t("nav.calc") }}</h1>
    <div class="sr" aria-live="polite" aria-atomic="true">{{ announce }}</div>
    <div class="calc-top">
      <div class="ctabs" role="group" :aria-label="t('calc.tabs')">
        <!-- on a tool, the calculator's tab goes back to the calculator; on the calculator it opens the type menu -->
        <Menu :items="modeItems" :text="typeLabel" :label="dateMode ? t('calc.backTo', { mode: typeLabel }) : t('calc.mode')" :inactive="dateMode" align="start" @activate="calc.mode = lastType" />
        <button v-for="m in TOOLS" :key="m.id" type="button" class="ctab" :class="{ on: calc.mode === m.id }" :aria-pressed="calc.mode === m.id" :title="modeHint(m.id)" @click="calc.mode = m.id">{{ modeName(m.id) }}</button>
      </div>
      <button v-if="adv || kbd" type="button" class="cvars" @click="varsOpen = true">{{ t("calc.vars") }}</button>
    </div>
    <PercentCalc v-if="calc.mode === 'percent' || calc.mode === 'discount'" :tool="calc.mode" />
    <TipCalc v-else-if="calc.mode === 'tip'" />
    <DateCalc v-else-if="dateMode" />
    <KeyboardCalc v-else-if="kbd" />
    <div v-else class="cdisp" role="group" :aria-label="t('calc.display')">
      <div class="cbar">
        <button v-if="adv" v-swap="angleLabel" type="button" class="cflag" :title="t('calc.angleUnit')" :aria-label="angleAria" @click="fkey('angle')">{{ angleLabel }}</button>
        <span v-if="calc.mem" class="cflag" :title="t('calc.memInUse')"><span aria-hidden="true">M</span><span class="sr">{{ t("calc.memInUse") }}</span></span>
        <NumFormat v-if="!progMode" :note="note" />
        <span v-else class="grow" />
        <button type="button" class="ib sm plain" :aria-label="t('key.back')" :disabled="!calc.expr" @click="tap('⌫')"><Icon name="backspace" /></button>
      </div>
      <div ref="exprEl" class="cexp num" :title="show(calc.expr)"><span aria-hidden="true">{{ typing ? "" : show(calc.expr) }}<span v-if="calc.answer" class="ceq"> =</span></span><span v-if="said" class="sr">{{ said }}</span></div>
      <button ref="resEl" type="button" class="cres num" :class="[size, { pre: previewing, err: !!calc.error }]" :title="t('c.copy')"
        :aria-label="t(calc.error ? 'calc.ariaError' : calc.answer ? 'calc.ariaAnswer' : previewing ? 'calc.ariaPreview' : 'calc.ariaError', { x: bigSaid })" @click="copyAnswer"><span>{{ bigShown }}</span></button>
    </div>
    <template v-if="dateMode || kbd" />
    <ProgPad v-else-if="progMode" :hit="hit" :clear="clearKey" @tap="tap" />
    <div v-else class="cpad">
      <FinPad v-if="fin" />
      <div v-if="adv" class="fkeys" role="group" :aria-label="t('calc.functions')">
        <button v-for="f in FKEYS" :key="f.aria" type="button" class="key k-fn" :class="{ on: f.on, hit: hit === f.k }" :aria-label="f.aria" :aria-pressed="f.on ?? undefined" @click="fkey(f.k)">{{ f.label }}</button>
      </div>
      <div class="bpad">
        <div class="memk" role="group" :aria-label="t('calc.memory')">
          <button v-for="m in MEM" :key="m.k" type="button" :class="{ hit: hit === m.k }" :aria-label="m.aria" :disabled="(m.k === 'MC' || m.k === 'MR') && !calc.mem" @click="tap(m.k)">{{ m.k }}</button>
        </div>
        <div class="keys" role="group" :aria-label="t('calc.keypad')">
          <button v-for="b in KEYS" :key="b.k" type="button" class="key" :class="['k-' + b.kind, { hit: hit === b.k }]" :aria-label="b.aria" @click="tap(b.k)">{{ b.label ?? b.k }}</button>
        </div>
      </div>
    </div>
    <VariablesSheet v-if="varsOpen" @close="varsOpen = false" />
  </div>
</template>
