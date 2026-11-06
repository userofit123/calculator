<script setup lang="ts">
// The number format and decimal places, chosen from the display: the format chip steps through Decimal, Fraction,
// Mixed, Sci and Eng (right-click or long-press it for the full list), the places chip opens a small popover with the
// formats and a decimal places stepper. Both are the same settings as Settings → Calculator. Small, so it is in the main
// bundle with the calculator. `note` says why an answer is a decimal although Fraction or Mixed is chosen.
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { settings, FORMATS, cycleFormat, fmtLabel, fmtShort, fmtHint } from "../core/calc";
import { t } from "../core/i18n";
import { safeArea } from "../core/device";
import Icon from "./Icon.vue";

defineProps<{ note?: string }>();
const MAX_PLACES = 15;
const fmt = computed(() => FORMATS.find((f) => f.id === settings.format) ?? FORMATS[0]!);
const open = ref(false), pos = ref({ top: 0, left: 0 }), el = ref<HTMLElement | null>(null), chip = ref<HTMLElement | null>(null);

async function show() {
  if (open.value) return close();
  open.value = true;
  const b = chip.value!.getBoundingClientRect();
  pos.value = { top: b.bottom + 6, left: b.left };
  await nextTick();
  const m = el.value!.getBoundingClientRect(), sa = safeArea();
  pos.value = {
    top: b.bottom + 6 + m.height > innerHeight - sa.bottom - 8 ? Math.max(sa.top + 8, b.top - m.height - 6) : b.bottom + 6,
    // right to left, the popover opens from the chip's right edge
    left: Math.max(sa.left + 8, Math.min(document.documentElement.dir === "rtl" ? b.right - m.width : b.left, innerWidth - sa.right - m.width - 8)),
  };
  setTimeout(() => { addEventListener("click", away, true); addEventListener("keydown", onKey, true); });
  items()[0]?.focus();
}
const items = () => Array.from(el.value?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
const away = (e: Event) => { if (!el.value?.contains(e.target as Node)) { e.stopPropagation(); close(false); } };
// Escape closes the popover only (it would clear the calculator otherwise)
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const l = items();
  if (!l.length) return;
  e.preventDefault();
  const i = l.indexOf(document.activeElement as HTMLElement);
  l[(i + (e.key === "ArrowDown" ? 1 : -1) + l.length) % l.length]!.focus();
};
// focus goes back to the chip unless the close came from a click elsewhere (that click decides where focus goes)
function close(refocus = true) {
  if (!open.value) return;
  open.value = false;
  removeEventListener("click", away, true); removeEventListener("keydown", onKey, true);
  if (refocus) chip.value?.focus();
}
const step = (d: number) => { settings.decimals = Math.max(0, Math.min(MAX_PLACES, settings.decimals + d)); };
onBeforeUnmount(() => close(false));
</script>

<template>
  <button
    type="button" class="cflag" :title="t('ui.nfTitle', { f: fmtLabel(fmt.id) })"
    :aria-label="t('ui.nfNext', { f: fmtLabel(fmt.id) })" @click="cycleFormat" @contextmenu.prevent="show"
  >{{ fmtShort(fmt.id) }}</button>
  <button ref="chip" type="button" class="cflag" :title="t('ui.nfPlaces')" :aria-label="t('ui.nfPlacesAria', { n: settings.decimals })" aria-haspopup="dialog" :aria-expanded="open" @click.stop="show">{{ t("ui.dp", { n: settings.decimals }) }}</button>
  <span class="cnote" :title="note">{{ note }}</span>
  <Teleport to="body">
    <div v-if="open" ref="el" class="mnu nfpop" role="dialog" :aria-label="t('ui.nf')" :style="{ top: pos.top + 'px', left: pos.left + 'px' }">
      <div role="radiogroup" :aria-label="t('ui.nf')" class="nfgrp">
        <button v-for="f in FORMATS" :key="f.id" type="button" role="radio" :aria-checked="settings.format === f.id" :class="{ on: settings.format === f.id }" @click="settings.format = f.id">
          <span class="mh"><span>{{ fmtLabel(f.id) }}</span><small>{{ fmtHint(f.id) }}</small></span><Icon v-if="settings.format === f.id" name="check" :size="16" class="mck" />
        </button>
      </div>
      <hr />
      <div class="nfstep">
        <span class="grow">{{ t("ui.places") }}</span>
        <button type="button" class="ib sm" :aria-label="t('ui.fewerPlaces')" :disabled="settings.decimals <= 0" @click="step(-1)">−</button>
        <span class="num nfn" aria-live="polite">{{ settings.decimals }}</span>
        <button type="button" class="ib sm" :aria-label="t('ui.morePlaces')" :disabled="settings.decimals >= MAX_PLACES" @click="step(1)">+</button>
      </div>
    </div>
  </Teleport>
</template>
