<script setup lang="ts">
// A sheet: a bottom sheet on the phone, a centred window on a computer. Closes with Esc, Back, a tap outside,
// or on the phone by pulling it down (from anywhere on it, unless its content is scrolled down).
import { onMounted, onBeforeUnmount, ref, nextTick, useId } from "vue";
import { usePullDown } from "../core/pullDown";
import { sheetOpened, sheetClosed } from "../core/sheets";
import { lockScroll } from "../core/scrollLock";
import Icon from "./Icon.vue";
import { t } from "../core/i18n";

// noHistory: no Back step of its own (see core/leave.ts)
const props = defineProps<{ title?: string; size?: "wide" | "full"; noClose?: boolean; noHistory?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const root = ref<HTMLElement | null>(null), sheet = ref<HTMLElement | null>(null);
// with sheets stacked (an exercise's preview over the picker) Esc closes only the one on top
const onTop = () => [...document.querySelectorAll(".scr:not(.leaving)")].at(-1) === root.value;
// Tab stays inside the sheet on top (it is modal): from the last control back to the first and the other way round
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
function trap(e: KeyboardEvent) {
  const l = Array.from(sheet.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((x) => x.offsetParent !== null);
  if (!l.length) { e.preventDefault(); sheet.value?.focus(); return; }
  const a = document.activeElement, first = l[0]!, last = l.at(-1)!;
  if (!sheet.value?.contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && (a === first || a === sheet.value)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}
const key = (e: KeyboardEvent) => {
  if (!onTop()) return;
  if (e.key === "Escape" && !props.noClose) { e.stopPropagation(); emit("close"); }
  else if (e.key === "Tab") trap(e);
};
const titleId = useId();
// where the focus was before: it goes back there when the sheet closes
let before: HTMLElement | null = null;
defineExpose({ onTop });
let backId = 0, unlock = () => {};
onMounted(() => {
  addEventListener("keydown", key); unlock = lockScroll();
  before = document.activeElement as HTMLElement | null;
  // the focus moves into the sheet: a field marked autofocus, else the sheet itself (never an arbitrary first field: on a phone
  // that would pop the on-screen keyboard). A field a picker or FinPad focuses itself is left alone.
  nextTick(() => {
    if (sheet.value?.contains(document.activeElement) && document.activeElement !== sheet.value) return;
    const f = sheet.value?.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
    (f ?? sheet.value)?.focus({ preventScroll: true });
  });
  if (!props.noClose && !props.noHistory) backId = sheetOpened(() => emit("close"));
});
const pull = usePullDown(() => sheet.value, () => root.value, () => !props.noClose, () => emit("close"));
// However a sheet is closed (its own buttons or the page), a copy of it plays the closing animation for a moment.
onBeforeUnmount(() => {
  removeEventListener("keydown", key); unlock();
  if (backId) sheetClosed(backId);
  if (before?.isConnected && (!document.activeElement || document.activeElement === document.body || root.value?.contains(document.activeElement))) before.focus({ preventScroll: true });
  const el = root.value;
  if (!el || pull.pulledAway || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.classList.add("leaving"); ghost.setAttribute("aria-hidden", "true"); ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 240);
});

</script>

<template>
  <Teleport to="body">
    <div ref="root" class="scr" @mousedown.self="!noClose && emit('close')">
      <div ref="sheet" class="sht" :class="size" role="dialog" aria-modal="true" tabindex="-1" :aria-labelledby="$slots.head ? undefined : titleId" :aria-label="$slots.head ? title : undefined">
        <div class="sh_h">
          <slot name="head"><h2 :id="titleId" class="sh_t">{{ title }}</h2></slot>
          <button v-if="!noClose" class="ib sm plain" :aria-label="t('c.close')" @click="emit('close')"><Icon name="close" /></button>
        </div>
        <div class="sh_b"><slot /></div>
        <div v-if="$slots.foot" class="sh_f"><slot name="foot" /></div>
      </div>
    </div>
  </Teleport>
</template>
