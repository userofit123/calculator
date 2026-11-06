<script setup lang="ts">
// The ⋮ menu: where secondary actions live, so screens stay calm. With `text` the button shows it (a mode switch).
import { ref, nextTick, onBeforeUnmount } from "vue";
import { lockScroll } from "../core/scrollLock";
import { isPhone, safeArea } from "../core/device";
import Icon from "./Icon.vue";
import { t } from "../core/i18n";
import { leaving } from "../core/motion";

// checked: the one chosen among options (a set's type, a side), marked with a tick at the end so every item keeps its own icon
interface MenuItem { label: string; hint?: string; icon?: string; run: () => void; danger?: boolean; sep?: boolean; hidden?: boolean; checked?: boolean }
// align "start": the menu opens from the button's left edge (as far as the screen allows), for a button that isn't the
// last thing in its row; otherwise its right edge lines up with the button's. Right to left it is the mirror image.
const props = defineProps<{ items: MenuItem[]; icon?: string; label?: string; text?: string; align?: "start" | "end" }>();
const open = ref(false), pos = ref({ top: 0, left: 0 }), btn = ref<HTMLElement | null>(null), el = ref<HTMLElement | null>(null);
// on the phone the menu is a bottom sheet over a scrim, so the page stays still behind it; on a computer it is a small popover with
// no scrim, and locking would shift fixed elements (the add button, minibars) by the scrollbar width on every open
let unlock = () => {};
async function toggle() {
  open.value = !open.value;
  if (!open.value) { unlock(); unlock = () => {}; return; }
  if (isPhone.value) unlock = lockScroll();
  const b = btn.value!.getBoundingClientRect();
  pos.value = { top: b.bottom + 6, left: b.right };
  await nextTick();
  const menu = el.value;
  if (!open.value || !menu) return; // closed again (or unmounted) within the same tick
  const m = { width: menu.offsetWidth, height: menu.offsetHeight }; // its size without the opening animation's scale
  // the Android app draws under its bars, so the screen's edges are the bars' inner edges, not the window's
  const sa = safeArea(), lo = innerHeight - sa.bottom - 8, hi = sa.top + 8;
  pos.value = { top: b.bottom + 6 + m.height > lo ? Math.max(hi, b.top - m.height - 6) : b.bottom + 6, left: Math.max(sa.left + 8, Math.min((props.align === "start") !== (document.documentElement.dir === "rtl") ? b.left : b.right - m.width, innerWidth - sa.right - m.width - 8)) };
  setTimeout(() => addEventListener("click", away, true));
  // the keyboard starts on the chosen item (a mode switch) or the first one
  (menu.querySelector<HTMLElement>('[aria-checked="true"]') ?? items()[0])?.focus();
}
const items = () => Array.from(el.value?.querySelectorAll<HTMLElement>("button") ?? []);
const away = (e: Event) => { if (!el.value?.contains(e.target as Node)) { e.stopPropagation(); close(false); } };
// focus goes back to the menu's button, unless a click elsewhere closed it (that click decides where focus goes)
const close = (refocus = true) => {
  const was = open.value;
  open.value = false; unlock(); unlock = () => {}; removeEventListener("click", away, true);
  if (was && refocus) btn.value?.focus({ preventScroll: true });
};
const pick = (i: MenuItem) => { close(); i.run(); };
// a menu's keys: arrows, Home and End move, Esc closes it (and nothing under it), Tab leaves it
function key(e: KeyboardEvent) {
  const l = items(), i = l.indexOf(document.activeElement as HTMLElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: l.length - 1 }[e.key];
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  else if (e.key === "Tab") close();
  else if (to !== undefined && l.length) { e.preventDefault(); l[(to + l.length) % l.length]!.focus(); }
}
onBeforeUnmount(() => close(false));
</script>

<template>
  <button v-if="text" ref="btn" class="mnub" :aria-label="label" aria-haspopup="menu" :aria-expanded="open" @click.stop="toggle"><span>{{ text }}</span><Icon name="down" :size="16" /></button>
  <button v-else ref="btn" class="ib sm plain" :aria-label="label ?? t('c.more')" aria-haspopup="menu" :aria-expanded="open" @click.stop="toggle"><Icon :name="icon ?? 'more'" /></button>
  <Teleport to="body">
    <Transition name="pop" @before-leave="leaving"><div v-if="open" ref="el" class="mnu" :style="{ top: pos.top + 'px', left: pos.left + 'px' }" role="menu" :aria-label="label ?? text ?? t('c.more')" @keydown="key">
      <template v-for="(i, k) in props.items.filter((x) => !x.hidden)" :key="k">
        <hr v-if="i.sep" role="separator" />
        <button type="button" tabindex="-1" :class="{ danger: i.danger, on: i.checked }" :role="i.checked != null ? 'menuitemradio' : 'menuitem'" :aria-checked="i.checked ?? undefined" @click="pick(i)"><Icon v-if="i.icon" :name="i.icon" :size="18" /><span v-if="i.hint" class="mh"><span>{{ i.label }}</span><small>{{ i.hint }}</small></span><span v-else class="ml">{{ i.label }}</span><Icon v-if="i.checked" name="check" :size="16" class="mck" /></button>
      </template>
    </div></Transition>
  </Teleport>
</template>
