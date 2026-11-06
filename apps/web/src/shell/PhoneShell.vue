<script setup lang="ts">
// The phone layout (Motus's): the page under the status bar, and the tabs in a blurred dock above the navigation bar.
// Moving between tabs slides towards the tab chosen; a sideways swipe on a page's empty space goes to the next tab.
import { ref, watch } from "vue";
import { NAV, PAGES, page, go } from "./nav";
import { sheetIsOpen } from "../core/sheets";
import Icon from "../components/Icon.vue";
import UpdateButton from "./UpdateButton.vue";
import { upd } from "../core/appUpdate";

const order = NAV.map((n) => n.name);
const motion = ref("page");
watch(page, (to, from) => { const a = order.indexOf(from), b = order.indexOf(to); motion.value = b > a ? "tnx" : "tpv"; }, { flush: "sync" });

let x0 = 0, y0 = 0, t0 = 0, ok = false;
function ts(e: TouchEvent) {
  const t = e.touches[0]!;
  x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  ok = e.touches.length === 1 && !sheetIsOpen()
    && !(e.target as HTMLElement).closest(".dock, .keys, .cdisp, input, textarea, select, .seg, .tabs, [data-noswipe]")
    && x0 > 24 && x0 < innerWidth - 24; // the screen edges belong to the phone's own back gesture
}
function te(e: TouchEvent) {
  if (!ok) return;
  const t = e.changedTouches[0]!, dx = t.clientX - x0, dy = t.clientY - y0;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3 || Date.now() - t0 > 900) return;
  const next = order[order.indexOf(page.value) + (dx < 0 ? 1 : -1)];
  if (next) go(next);
}
</script>

<template>
  <div class="pshell" :class="{ hasupd: !!upd.latest }" @touchstart.passive="ts" @touchend.passive="te">
    <div class="pmain"><Transition :name="motion" mode="out-in"><component :is="PAGES[page]" :key="page" /></Transition></div>
    <div class="dock">
      <UpdateButton phone />
      <div class="tabbar" :style="{ '--tabs': NAV.length }">
        <button v-for="t in NAV" :key="t.name" type="button" :class="{ on: page === t.name }" :aria-current="page === t.name ? 'page' : undefined" @click="go(t.name)"><span class="ic"><Icon :name="t.icon" :size="22" /></span>{{ t.label }}</button>
      </div>
    </div>
  </div>
</template>
