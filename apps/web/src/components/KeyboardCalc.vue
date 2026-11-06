<script lang="ts">
import { reactive } from "vue";
/** This session's lines, listed when history isn't kept (kept across pages until the app closes) */
const session = reactive<{ id: number; e: string; r: string; x: string }[]>([]);
let sessionId = 0;
</script>

<script setup lang="ts">
// Keyboard mode (like GNOME's): no keypad. The earlier lines, expression and answer, newest at the bottom like a
// terminal, above one real text line: the browser's own caret, selection, arrow keys, Home/End, copy, paste and undo.
// Enter works the line out (the same evaluate, ans, variables and history as the other modes) and clears it;
// ArrowUp/Down bring back earlier lines; clicking an earlier expression or answer types it in at the caret.
// Small, so in the main bundle: a computer's first open starts here and shouldn't wait for a chunk.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { calc, settings, show, linePreview, enterLine, lineExpr, typedValue, valueText, ANGLES } from "../core/calc";
import { history, histPrefs } from "../core/history";
import { freshRecall, recallLines, recallStep, pushCapped, pageKeyTarget } from "../core/keyboard";
import { isPhone } from "../core/device";

const inp = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
// a sum being typed in another mode carries over (an answer doesn't: the line starts empty under it)
const line = ref(calc.answer || calc.error ? "" : show(calc.expr));
const err = ref("");
const root = ref<HTMLElement | null>(null);
/** the expression last handed to calc.expr from here: a different one later came from outside (Variables, History) */
let synced = calc.expr;
let rc = freshRecall();

/** Oldest first (the newest at the bottom); programming-mode sums are left out (their digits need their base) */
const items = computed(() => (histPrefs.keep ? history.filter((h) => !h.b).slice(0, 200).reverse() : session));
const recallList = computed(() => recallLines(items.value.map((h) => show(h.e)).reverse()));
const pv = computed(() => linePreview(line.value));
const angleLabel = computed(() => ANGLES.find((a) => a.id === settings.angle)!.label);
function nextAngle() { const i = ANGLES.findIndex((a) => a.id === settings.angle); settings.angle = ANGLES[(i + 1) % ANGLES.length]!.id; }

const toBottom = () => nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight; });
watch(() => items.value.length, toBottom);

/** The line goes on to the calculator as typed, so another mode (or a page change) carries on from it */
function sync() {
  err.value = "";
  calc.expr = lineExpr(line.value); calc.answer = ""; calc.error = "";
  synced = calc.expr;
}
// the expression changed from outside (a variable chosen in the Variables sheet, a sum reused from History): take it
// up, the caret at the end when it only added to what was typed
watch(() => calc.expr, (v) => {
  if (v === synced) return;
  line.value = show(v);
  sync();
  nextTick(() => { const el = inp.value; if (el) { el.value = line.value; el.setSelectionRange(line.value.length, line.value.length); } });
});
let recalling = false;
function onInput() { line.value = inp.value?.value ?? line.value; if (!recalling) rc = freshRecall(); sync(); }
/** Types text in at the caret (over a selection) as the browser's own edit, so Ctrl+Z takes it back */
function insert(text: string, all = false) {
  const el = inp.value;
  if (!el) return;
  el.focus();
  if (all) el.select();
  const done = text ? document.execCommand?.("insertText", false, text) : document.execCommand?.("delete");
  if (!done) { // no execCommand here: set it directly (no undo for this step)
    el.setRangeText(text, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end");
    onInput();
  }
}
function recall(dir: "up" | "down") {
  const s = recallStep(recallList.value, rc, line.value, dir);
  if (!s) return;
  recalling = true;
  try { insert(s.text, true); } finally { recalling = false; }
  rc = s.st;
}
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.keyCode === 229) return; // 229: Safari's IME
  if (e.key === "Enter") {
    e.preventDefault();
    const er = enterLine(line.value);
    if (er) { err.value = er; return; }
    if (!line.value.trim()) return;
    if (!histPrefs.keep) pushCapped(session, { id: ++sessionId, e: calc.expr, r: calc.answer, x: calc.ans }, 200);
    synced = calc.expr;
    line.value = ""; err.value = ""; rc = freshRecall(); toBottom();
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    recall(e.key === "ArrowUp" ? "up" : "down");
  } else if (e.key === "Escape" && line.value) {
    e.preventDefault();
    insert("", true);
  }
}
const useExpr = (e: string) => insert(show(e));
const useAnswer = (x: string) => { const v = typedValue(x); if (v) insert(show(v)); };

// typing anywhere on the page (not in another field or a popup) goes to the line
const busy = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]") || !!document.querySelector(".scr, #pop.on");
function onPageKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || busy(e.target) || (e.key.length !== 1 && e.key !== "Backspace")) return;
  // only when nothing is focused (or the calculator's own area): Space on a button must press it, not move away
  if (!pageKeyTarget(e.target as Element | null, document, root.value)) return;
  inp.value?.focus({ preventScroll: true });
}
function onPaste(e: ClipboardEvent) {
  if (busy(e.target)) return;
  const t = e.clipboardData?.getData("text/plain");
  if (!t) return;
  e.preventDefault(); insert(t.replace(/\s+/g, " ").trim());
}
onMounted(() => {
  addEventListener("keydown", onPageKey); document.addEventListener("paste", onPaste);
  toBottom();
  // on a phone the system keyboard would cover the list at once: it opens when the line is tapped
  if (!isPhone.value) inp.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => { removeEventListener("keydown", onPageKey); document.removeEventListener("paste", onPaste); });
</script>

<template>
  <div ref="root" class="kcalc">
    <ol ref="listEl" class="klist" aria-label="Earlier lines">
      <li v-for="h in items" :key="'id' in h ? h.id : h.t" class="krow">
        <button type="button" class="kexp num" title="Type in this sum" @click="useExpr(h.e)">{{ show(h.e) }}</button>
        <button type="button" class="kres num" title="Type in this answer" @click="useAnswer(h.x)">= {{ show(h.r) }}</button>
      </li>
      <li v-if="!items.length" class="kempty">Type a sum below and press Enter. ArrowUp brings back earlier lines.</li>
    </ol>
    <div class="kline">
      <div class="cbar">
        <button type="button" class="cflag" title="Angle unit" @click="nextAngle">{{ angleLabel }}</button>
        <span v-if="calc.mem" class="cflag" title="Memory in use">M</span>
        <span v-if="calc.ans" class="kans" title="The last answer, as ans">ans = {{ show(valueText(calc.ans)) }}</span>
      </div>
      <input
        ref="inp" v-model="line" class="kin num" type="text" inputmode="text" enterkeyhint="done" autocomplete="off"
        autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Sum to work out" placeholder="2 × (3 + 4)"
        @input="onInput" @keydown="onKey"
      />
      <div class="kpre num" :class="{ err: !!err }" aria-live="polite">{{ err || (pv ? "= " + show(pv) : "") }}</div>
    </div>
  </div>
</template>
