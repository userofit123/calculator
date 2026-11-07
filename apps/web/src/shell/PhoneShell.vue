<script setup lang="ts">
// The phone layout (Motus's): the page under the status bar, and the tabs in a blurred dock above the navigation bar.
// Moving between tabs slides towards the tab chosen; a sideways swipe on a page's empty space goes to the next tab
// (not while something under the finger can still scroll that way).
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { canMove, dur } from "../core/motion";
import { NAV, PAGES, page, go } from "./nav";
import { sheetIsOpen } from "../core/sheets";
import { swipeBlocked, type SideScroller } from "../core/swipe";
import Icon from "../components/Icon.vue";
import UpdateButton from "./UpdateButton.vue";
import { upd } from "../core/appUpdate";
import { webUpd } from "../core/update";
import { t as tr, rtl } from "../core/i18n";

const order = NAV.map((n) => n.name);
const motion = ref("page");
watch(page, (to, from) => { const a = order.indexOf(from), b = order.indexOf(to); motion.value = b > a ? "tnx" : "tpv"; }, { flush: "sync" });

// the tab highlight glides to the chosen tab, stretching on the way (as the computer's rail and the tab rows do)
const bar = ref<HTMLElement | null>(null), pill = ref<HTMLElement | null>(null);
let at: { x: number; y: number; w: number; h: number } | null = null, anim: Animation | null = null;
function place(animate: boolean) {
  const tb = bar.value, p = pill.value; if (!tb || !p) return;
  const ic = tb.querySelector<HTMLElement>("button.on .ic"), b = ic?.parentElement;
  if (!ic || !b) { p.style.display = "none"; tb.classList.remove("pl"); at = null; return; }
  const to = { x: b.offsetLeft + ic.offsetLeft, y: b.offsetTop + ic.offsetTop, w: ic.offsetWidth, h: ic.offsetHeight };
  p.style.display = ""; p.style.width = to.w + "px"; p.style.height = to.h + "px"; p.style.borderRadius = getComputedStyle(ic).borderTopLeftRadius; tb.classList.add("pl");
  const set = (r: typeof to, sx = 1) => `translate(${r.x}px,${r.y}px) scale(${sx},1)`;
  const from = at; at = to; anim?.cancel();
  p.style.transform = set(to);
  if (!animate || !from || from.x === to.x || !canMove()) return;
  const mid = { ...to, x: (from.x + to.x) / 2 - to.w * 0.15 };
  anim = p.animate([{ transform: set(from) }, { transform: set(mid, 1.3), offset: 0.45 }, { transform: set(to) }], { duration: dur(3), easing: "cubic-bezier(.4,0,.2,1)" });
}
watch(page, () => nextTick(() => place(true)));
const onResize = () => place(false);
let mo: MutationObserver | null = null;
onMounted(() => {
  nextTick(() => place(false)); addEventListener("resize", onResize);
  mo = new MutationObserver(onResize); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "data-rad", "data-fnt"] });
  document.fonts?.ready.then(onResize);
});
onBeforeUnmount(() => { removeEventListener("resize", onResize); mo?.disconnect(); });
// the desktop app: the page draws the title strip that drags the window (styles/layout.css, html.dframe)
const dframe = typeof window !== "undefined" && !!window.desktopFrame;

/** The things that scroll sideways under the finger (the converter's category chips, a wide table, the display's long
 *  number...), as they are when the touch starts. Whether they block the swipe is decided at the end, by direction:
 *  one already at its edge in that direction lets the page change. Checked from the target up to the shell. */
function sideScrollers(el: Element | null, shell: Element): SideScroller[] {
  const out: SideScroller[] = [];
  for (; el && el !== shell; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const cs = getComputedStyle(el);
      if (/auto|scroll/.test(cs.overflowX)) out.push({ left: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, rtl: cs.direction === "rtl" });
    }
  }
  return out;
}
let x0 = 0, y0 = 0, t0 = 0, ok = false, scrollers: SideScroller[] = [];
function ts(e: TouchEvent) {
  const t = e.touches[0]!;
  x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  // the keypad and display are not excluded: a swipe that starts on a key moves the page (and no click follows it)
  ok = e.touches.length === 1 && !sheetIsOpen()
    && !(e.target as HTMLElement).closest(".dock, input, textarea, select, .seg, .tabs, [data-noswipe]")
    && x0 > 24 && x0 < innerWidth - 24; // the screen edges belong to the phone's own back gesture
  scrollers = ok ? sideScrollers(e.target as Element, e.currentTarget as Element) : [];
}
function te(e: TouchEvent) {
  if (!ok) return;
  const t = e.changedTouches[0]!, dx = t.clientX - x0, dy = t.clientY - y0;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3 || Date.now() - t0 > 900) return;
  if (swipeBlocked(scrollers, dx)) return;
  const next = order[order.indexOf(page.value) + ((dx < 0) !== rtl.value ? 1 : -1)];
  if (next) go(next);
}
</script>

<template>
  <div v-if="dframe" id="dragbar" aria-hidden="true" />
  <div class="pshell" :class="{ hasupd: !!upd.latest || webUpd.state === 'ready' }" @touchstart.passive="ts" @touchend.passive="te">
    <div class="pmain" role="main"><Transition :name="motion" mode="out-in"><component :is="PAGES[page]" :key="page" /></Transition></div>
    <div class="dock">
      <UpdateButton phone />
      <div ref="bar" class="tabbar" role="navigation" :style="{ '--tabs': NAV.length }" :aria-label="tr('nav.menu')">
        <i ref="pill" class="tbi" style="transform-origin:0 0" aria-hidden="true" />
        <button v-for="t in NAV" :key="t.name" type="button" :class="{ on: page === t.name }" :aria-current="page === t.name ? 'page' : undefined" @click="go(t.name)"><span class="ic"><Icon :name="t.icon" :size="22" /></span>{{ tr(t.label) }}</button>
      </div>
    </div>
  </div>
</template>
