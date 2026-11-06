<script setup lang="ts">
// Programming mode (in the main bundle, so it is there on the first paint when it was the last mode used): the number in all four bases (tap one to switch to it, the current
// one to copy it), the word's bits (tap a bit to flip it), word size and signed numbers, and the keys: bit operators
// with a 2nd layer (NAND NOR XNOR, rotate), shifts, complements, the hex digits and the number pad. Digits that aren't
// digits of the chosen base are off. On the phone the bases and the bits share one place (a switch), so it all fits.
import { computed, ref } from "vue";
import { BASES, WORD_SIZES, formatInt, groupDigits, toWord, toggleBit, type Base } from "@calc/core";
import { calc, prog, progValue, setProgValue, setBase } from "../core/calc";
import { isPhone } from "../core/device";
import { toast } from "../core/toast";
import Icon from "./Icon.vue";

const props = defineProps<{ hit: string; clear: string }>();
const emit = defineEmits<{ tap: [k: string] }>();
const tap = (k: string) => emit("tap", k);

const value = computed(progValue);
/** each base's digits, grouped for reading (binary and hex in fours, octal and decimal in threes) */
const rows = computed(() => BASES.map((b) => {
  const v = value.value;
  const s = v === null ? "" : formatInt(v, b.base, prog);
  return { ...b, text: s && groupDigits(s, b.base === 2 || b.base === 16 ? 4 : 3) };
}));
async function pickBase(b: Base, text: string) {
  if (b !== prog.base) { setBase(b); return; }
  if (!text) return;
  try { await navigator.clipboard.writeText(text.replace(/ /g, "")); toast("Copied"); } catch { /* no clipboard here */ }
}

// the bits, highest first, in rows of 16 (phone) or 32 (computer), each row in nibbles
const bitRows = computed(() => {
  const u = value.value === null ? null : toWord(value.value, prog);
  const per = Math.min(prog.wordSize, isPhone.value ? 16 : 32), out: { hi: number; lo: number; nibbles: { i: number; on: boolean }[][] }[] = [];
  for (let hi = prog.wordSize - 1; hi >= 0; hi -= per) {
    const nibbles = [];
    for (let n = hi; n > hi - per; n -= 4) nibbles.push([0, 1, 2, 3].map((j) => ({ i: n - j, on: u !== null && ((u >> BigInt(n - j)) & 1n) === 1n })));
    out.push({ hi, lo: hi - per + 1, nibbles });
  }
  return out;
});
function flip(i: number) { setProgValue(toggleBit(value.value ?? 0n, i, prog)); }

const panel = ref<"bases" | "bits">("bases");
const cycleWord = () => { prog.wordSize = WORD_SIZES[(WORD_SIZES.indexOf(prog.wordSize) + 1) % WORD_SIZES.length]!; };

const second = ref(false);
interface Key { k: string; label: string; aria: string; k2?: string; label2?: string; aria2?: string; on?: boolean }
const FKEYS = computed<Key[]>(() => [
  { k: "2nd", label: "2nd", aria: "Second functions", on: second.value },
  { k: "op: AND ", label: "AND", aria: "Bitwise AND (&)", k2: "op: NAND ", label2: "NAND", aria2: "Bitwise NAND" },
  { k: "op: OR ", label: "OR", aria: "Bitwise OR (|)", k2: "op: NOR ", label2: "NOR", aria2: "Bitwise NOR" },
  { k: "op: XOR ", label: "XOR", aria: "Bitwise XOR (^)", k2: "op: XNOR ", label2: "XNOR", aria2: "Bitwise XNOR" },
  { k: "fn:NOT ", label: "NOT", aria: "Bitwise NOT (~)" },
  { k: "op: << ", label: "<<", aria: "Shift left (<)", k2: "op: rol ", label2: "rol", aria2: "Rotate left within the word" },
  { k: "op: >> ", label: ">>", aria: "Shift right (>)", k2: "op: ror ", label2: "ror", aria2: "Rotate right within the word" },
  { k: "fn:ones(", label: "1's", aria: "Ones' complement" },
  { k: "fn:twos(", label: "2's", aria: "Two's complement" },
  { k: "op: mod ", label: "mod", aria: "Modulo (%)" },
].map((f) => (second.value && f.k2 ? { ...f, k: f.k2, label: f.label2!, aria: f.aria2! } : f)));
function fkey(k: string) { if (k === "2nd") { second.value = !second.value; return; } tap(k); }

type Kind = "n" | "op" | "fn" | "eq";
const KEYS = computed<{ k: string; label?: string; kind: Kind; aria?: string; icon?: string }[]>(() => [
  { k: props.clear, kind: "fn", aria: props.clear === "C" ? "Clear number" : "Clear all" }, { k: "()", label: "( )", kind: "fn", aria: "Brackets" }, { k: "fn:ans", label: "ans", kind: "fn", aria: "Last answer" }, { k: "÷", kind: "op", aria: "Divide (whole numbers)" },
  { k: "7", kind: "n" }, { k: "8", kind: "n" }, { k: "9", kind: "n" }, { k: "×", kind: "op", aria: "Multiply" },
  { k: "4", kind: "n" }, { k: "5", kind: "n" }, { k: "6", kind: "n" }, { k: "−", kind: "op", aria: "Minus" },
  { k: "1", kind: "n" }, { k: "2", kind: "n" }, { k: "3", kind: "n" }, { k: "+", kind: "op", aria: "Plus" },
  { k: "±", kind: "n", aria: "Change sign" }, { k: "0", kind: "n" }, { k: "⌫", kind: "fn", aria: "Delete", icon: "backspace" }, { k: "=", kind: "eq", aria: "Equals" },
]);
const HEX = ["A", "B", "C", "D", "E", "F"];
const DIGITS = "0123456789ABCDEF";
/** a digit key is off when it isn't a digit of the chosen base */
const off = (k: string) => k.length === 1 && DIGITS.includes(k) && DIGITS.indexOf(k) >= prog.base;
</script>

<template>
  <!-- word size, sign and (phone) the bases/bits switch sit on the mode menu's line, so the keys get the height -->
  <Teleport defer to=".calc-top">
    <div class="pbar">
      <button type="button" class="cflag" title="Word size" :aria-label="`Word size ${prog.wordSize} bits`" @click="cycleWord">{{ prog.wordSize }}-bit</button>
      <button type="button" class="cflag" :class="{ on: prog.signed }" title="Signed numbers (two's complement)" :aria-pressed="prog.signed" @click="prog.signed = !prog.signed">{{ prog.signed ? "Signed" : "Unsigned" }}</button>
      <span class="grow" />
      <div v-if="isPhone" class="seg sm"><button type="button" :class="{ on: panel === 'bases' }" @click="panel = 'bases'">Bases</button><button type="button" :class="{ on: panel === 'bits' }" @click="panel = 'bits'">Bits</button></div>
    </div>
  </Teleport>
  <div class="ppanel">
    <div v-if="!isPhone || panel === 'bases'" class="pbases" role="group" aria-label="Number base">
      <button v-for="r in rows" :key="r.base" type="button" class="pbase" :class="{ on: prog.base === r.base }" :aria-pressed="prog.base === r.base" :title="prog.base === r.base ? 'Copy' : `Switch to ${r.name}`" @click="pickBase(r.base, r.text)">
        <span class="plab">{{ r.label }}</span><span class="pval num">{{ r.text || "-" }}</span>
      </button>
    </div>
    <div v-if="!isPhone || panel === 'bits'" class="pbits num" role="group" aria-label="Bits (tap to flip)" :class="{ off: value === null }">
      <div v-for="row in bitRows" :key="row.hi" class="prow">
        <span class="pidx">{{ row.hi }}</span>
        <span v-for="(nb, j) in row.nibbles" :key="j" class="pnib">
          <button v-for="b in nb" :key="b.i" type="button" class="pbit" :class="{ on: b.on }" :aria-label="`Bit ${b.i}`" :aria-pressed="b.on" :disabled="value === null" @click="flip(b.i)">{{ b.on ? 1 : 0 }}</button>
        </span>
        <span class="pidx">{{ row.lo }}</span>
      </div>
    </div>
  </div>
  <div class="cpad ppad">
    <div class="pfn">
      <div class="fkeys" role="group" aria-label="Bit operations">
        <button v-for="f in FKEYS" :key="f.aria" type="button" class="key k-fn" :class="{ on: f.on, hit: props.hit === f.k }" :aria-label="f.aria" :aria-pressed="f.on ?? undefined" @click="fkey(f.k)">{{ f.label }}</button>
      </div>
      <div class="hexk" role="group" aria-label="Hex digits">
        <button v-for="h in HEX" :key="h" type="button" class="key k-n" :class="{ hit: props.hit === h }" :disabled="off(h)" @click="tap(h)">{{ h }}</button>
      </div>
    </div>
    <div class="keys" role="group" aria-label="Keypad">
      <button v-for="b in KEYS" :key="b.k" type="button" class="key" :class="['k-' + b.kind, { hit: props.hit === b.k }]" :aria-label="b.aria" :disabled="off(b.k) || (b.k === '⌫' && !calc.expr)" @click="tap(b.k)">
        <Icon v-if="b.icon" :name="b.icon" /><template v-else>{{ b.label ?? b.k }}</template>
      </button>
    </div>
  </div>
</template>

<style>
/* Programming mode. Tokens only, like the rest of the calculator (calc.css). */
.ppanel { display: flex; flex-direction: column; gap: calc(var(--kg) * .6); }
.pbar { display: flex; flex-direction: row; align-items: center; gap: calc(var(--hg) * .6); }
.cflag.on { color: var(--acc); background: color-mix(in srgb, var(--acc) 16%, var(--bg)); }
.pbar .seg { margin: 0; }
.pbar .seg button { padding-block: calc(var(--lpy) * .3); font-size: 12.5px; }

/* the four bases: the chosen one lit with the accent, each a button (switch, or copy the chosen one) */
.pbases { display: flex; flex-direction: column; border-radius: var(--r-sm); background: var(--s1); padding: calc(var(--cpy) * .25) calc(var(--cpx) * .5); }
.pbase { display: flex; align-items: baseline; gap: var(--hg); border: 0; background: none; font-family: inherit; color: var(--tx2); padding: calc(var(--lpy) / 6) 0; cursor: pointer; text-align: end; min-width: 0; border-radius: var(--r-sm); }
.pbase:hover { color: var(--tx); }
.plab { flex: none; width: 3.2em; text-align: start; font-size: 11.5px; font-weight: 700; letter-spacing: .4px; }
.pval { flex: 1 1 auto; min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
.pbase.on { color: var(--tx); }
.pbase.on .plab { color: var(--acc); }

/* the bits: rows of nibbles, each bit a small key (1 in the accent); the row's highest and lowest bit numbers beside */
.pbits { display: flex; flex-direction: column; gap: calc(var(--lpy) * .2); border-radius: var(--r-sm); background: var(--s1); padding: calc(var(--cpy) * .25) calc(var(--cpx) * .5); }
.pbits.off { opacity: .5; }
.prow { display: flex; align-items: center; justify-content: center; gap: calc(var(--kg) * .8); }
.pidx { flex: none; width: 2em; font-size: 10.5px; color: var(--tx2); text-align: center; }
.pnib { display: flex; flex: 0 1 auto; min-width: 0; }
.pbit { flex: 0 1 auto; width: 20px; min-width: 0; border: 0; background: none; font-family: inherit; font-size: 13.5px; line-height: 1.6; color: var(--tx2); cursor: pointer; border-radius: var(--r-sm); padding: 0; }
.pbit.on { color: var(--acc); font-weight: 700; }
.pbit:hover:not(:disabled) { background: var(--s2); }
.pbit:disabled { cursor: default; }

/* the keys: bit operators 5 across (as Advanced's), the hex digits 6 across, then the number pad */
.pfn { display: flex; flex-direction: column; gap: calc(var(--kg) * .8); }
.hexk { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-auto-rows: minmax(calc(var(--kh) * .78), auto); gap: calc(var(--kg) * .8); }
.hexk .key { font-size: calc(var(--kfs) - 4px); }
.ppad .key:disabled { opacity: .3; cursor: default; pointer-events: none; }
.ppad .keys .ico { color: var(--tx2); }

/* the phone: small display, the panel, the keys get the rest (Advanced's sizes) */
html.phone .calc.prog { min-height: 620px; }
html.phone .calc.prog .cdisp { flex: 0 0 auto; min-height: 0; max-height: none; gap: 0; }
html.phone .calc.prog .cbar { display: none; } /* delete is a key here, and there is no memory */
html.phone .calc.prog .cres { font-size: 34px; }
html.phone .calc.prog .cres.m { font-size: 30px; }
html.phone .calc.prog .cres.s { font-size: 26px; }
html.phone .hexk { grid-auto-rows: minmax(calc(var(--kh) * .62), auto); }
html.phone .ppanel { gap: calc(var(--kg) * .4); }
html.phone .pbases, html.phone .pbits { min-height: 92px; justify-content: center; }
html.phone .pbit { line-height: 1.45; }

/* a computer: the bit keys and hex digits beside the number pad */
html:not(.phone) .calc.prog { max-width: 900px; }
html:not(.phone) .calc.prog .cpad { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); gap: calc(var(--kg) * 2); align-items: end; }
html:not(.phone) .calc.prog .fkeys, html:not(.phone) .calc.prog .hexk { grid-auto-rows: minmax(var(--kh), auto); }
@media (max-width: 760px) { html:not(.phone) .calc.prog .cpad { display: flex; } }
</style>
