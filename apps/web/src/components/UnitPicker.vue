<script setup lang="ts">
// A drop-down for long lists (units, currencies) with a search field on top: type part of a name, symbol or code
// ("kg", "pound", "yen"), arrows to move, Enter to pick, Esc to close. Opens as a panel on a computer and as a sheet on
// the phone (PickerPop), like the app's other pickers.
import { computed, nextTick, ref, useId, watch } from "vue";
import { isPhone } from "../core/device";
import Icon from "./Icon.vue";
import PickerPop from "./PickerPop.vue";
import { lower, t } from "../core/i18n";

export interface PickOption { value: string; label: string; lead?: string; hint?: string; keys?: string }
const props = defineProps<{ modelValue: string; options: PickOption[]; title: string }>();
const emit = defineEmits<{ "update:modelValue": [v: string] }>();

const id = useId();
const open = ref(false), find = ref(""), hi = ref(0), btn = ref<HTMLButtonElement | null>(null), field = ref<HTMLInputElement | null>(null);
const cur = computed(() => props.options.find((o) => o.value === props.modelValue));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const shown = computed(() => {
  const words = norm(find.value).split(/\s+/).filter(Boolean);
  if (!words.length) return props.options;
  return props.options.filter((o) => { const text = norm(`${o.label} ${o.lead ?? ""} ${o.hint ?? ""} ${o.keys ?? ""} ${o.value}`); return words.every((w) => text.includes(w)); });
});
watch(find, () => { hi.value = 0; });
watch([hi, open], async () => { await nextTick(); if (open.value) document.getElementById(`${id}-${hi.value}`)?.scrollIntoView({ block: "nearest" }); });

async function show() {
  find.value = ""; open.value = true;
  hi.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue));
  await nextTick();
  // on the phone the keyboard would cover half the list: the search field is focused only when tapped
  if (!isPhone.value) field.value?.focus({ preventScroll: true });
}
function close(refocus = true) { open.value = false; if (refocus && !isPhone.value) btn.value?.focus({ preventScroll: true }); }
function pick(o: PickOption) { close(); if (o.value !== props.modelValue) emit("update:modelValue", o.value); }
function key(e: KeyboardEvent) {
  const n = shown.value.length;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (n) hi.value = (hi.value + (e.key === "ArrowDown" ? 1 : n - 1)) % n; }
  else if (e.key === "Enter") { e.preventDefault(); const o = shown.value[hi.value]; if (o) pick(o); }
  else if (e.key === "Tab") close(false);
}
function btnKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey)) {
    // typing on the closed field starts a search with that letter
    if (e.key.length === 1) { e.preventDefault(); void show().then(() => { find.value = e.key; }); } else { e.preventDefault(); void show(); }
  }
}
</script>

<template>
  <button ref="btn" type="button" class="fpick upk" role="combobox" aria-haspopup="listbox" :aria-expanded="open" :aria-label="cur ? `${title}: ${cur.label}` : title" @click="open ? close() : show()" @keydown="btnKey">
    <span class="v"><span v-if="cur?.lead" class="ld">{{ cur.lead }}</span>{{ cur?.label ?? "" }}</span><Icon name="down" :size="16" />
  </button>
  <PickerPop v-if="open" :anchor="btn" :title="title" @close="close(false)">
    <div class="upf">
      <input ref="field" v-model="find" type="search" :placeholder="t('ui.searchIn', { what: lower(title) })" :aria-label="t('ui.searchIn', { what: lower(title) })" autocomplete="off" spellcheck="false" enterkeyhint="done"
        role="searchbox" :aria-controls="`${id}-l`" :aria-activedescendant="shown.length ? `${id}-${hi}` : undefined" @keydown="key" />
    </div>
    <div :id="`${id}-l`" class="asl upl" role="listbox">
      <div v-for="(o, i) in shown" :id="`${id}-${i}`" :key="o.value" class="aso" role="option" :aria-selected="o.value === modelValue"
        :class="{ sel: o.value === modelValue, hi: i === hi }" @click="pick(o)" @mousemove="hi = i">
        <span v-if="o.lead" class="ld">{{ o.lead }}</span>
        <span class="ol"><span>{{ o.label }}</span><small v-if="o.hint">{{ o.hint }}</small></span><Icon name="check" :size="16" />
      </div>
      <div v-if="!shown.length" class="none">{{ t("ui.noMatch", { q: find }) }}</div>
    </div>
  </PickerPop>
</template>

<style scoped>
.upk { width: 100%; }
.upk .v { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ld { flex: none; min-width: 2.6em; color: var(--tx2); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
.upf { position: sticky; top: -6px; z-index: 1; margin-top: -6px; padding: 6px 0 var(--hg); background: var(--s1); }
.upf input { width: 100%; }
.aso { display: flex; align-items: center; gap: 10px; padding: calc(var(--lpy) - 1px) calc(var(--cpx) - 4px); border-radius: 10px; font-size: var(--fs); line-height: 1.3; color: var(--tx); cursor: pointer; }
.aso.hi { background: var(--s2); }
.aso.sel { color: var(--acc); font-weight: 600; }
.aso > .ico { flex: none; opacity: 0; }
.aso.sel > .ico { opacity: 1; }
.ol { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ol small { font-size: var(--fs-sm); font-weight: 400; color: var(--tx2); }
.none { padding: var(--lpy) calc(var(--cpx) - 4px); color: var(--tx2); font-size: var(--fs); }
/* a sheet on the phone: rows big enough for a thumb, the list scrolls with the sheet */
.sh_b .upl { margin: 0 -10px; }
.sh_b .upf { top: -4px; margin-top: -4px; padding-top: 4px; background: var(--bg); }
.sh_b .aso { min-height: var(--lmh); padding: var(--lpy) 12px; font-size: var(--fs-lg); border-radius: var(--r-sm); }
</style>
