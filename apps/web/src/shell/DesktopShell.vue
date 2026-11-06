<script setup lang="ts">
// The computer layout (Motus's, from Money Manager): the rail with its gliding highlight, the logo (click: a random
// look), the pages, and Appearance at the bottom. The window's own frame and title bar come from the desktop app.
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { NAV, PAGES, page, go } from "./nav";
import { appearanceOpen } from "../core/ui";
import Icon from "../components/Icon.vue";
import Logo from "./Logo.vue";
import UpdateButton from "./UpdateButton.vue";
import { t } from "../core/i18n";

const nav = ref<HTMLElement | null>(null), pill = ref<HTMLElement | null>(null);

// the highlight glides from the previous page to the open one, stretching on the way (Money Manager's AppNav)
let at: { x: number; y: number; w: number; h: number } | null = null, anim: Animation | null = null;
function place(animate: boolean) {
  const nv = nav.value, p = pill.value; if (!nv || !p) return;
  const b = nv.querySelector<HTMLElement>(".nb.on"), ic = b?.querySelector<HTMLElement>(".ic");
  if (!b || !ic) { p.style.display = "none"; nv.classList.remove("pl"); at = null; return; }
  const to = { x: b.offsetLeft + ic.offsetLeft, y: b.offsetTop + ic.offsetTop, w: ic.offsetWidth, h: ic.offsetHeight };
  p.style.display = ""; p.style.width = to.w + "px"; p.style.height = to.h + "px"; p.style.borderRadius = getComputedStyle(ic).borderTopLeftRadius; nv.classList.add("pl");
  const set = (r: typeof to) => `translate(${r.x}px,${r.y}px) scale(${r.w / to.w},${r.h / to.h})`;
  const from = at; at = to; anim?.cancel();
  p.style.transform = set(to);
  if (!animate || !from || from.y === to.y || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const top = Math.min(from.y, to.y), bot = Math.max(from.y + from.h, to.y + to.h);
  const mid = { x: to.x + to.w * 0.2, y: top, w: to.w * 0.6, h: bot - top };
  anim = p.animate([{ transform: set(from) }, { transform: set(mid), offset: 0.5 }, { transform: set(to) }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
}
watch(page, () => nextTick(() => place(true)));
const onResize = () => place(false);
let mo: MutationObserver | null = null;
onMounted(() => {
  nextTick(() => place(false)); setTimeout(onResize, 80); addEventListener("resize", onResize);
  mo = new MutationObserver(onResize); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-rad", "data-nav", "data-nsp", "data-fnt"] });
  document.fonts?.ready.then(onResize);
});
onBeforeUnmount(() => { removeEventListener("resize", onResize); mo?.disconnect(); });
</script>

<template>
  <div class="shell">
    <nav ref="nav" :aria-label="t('nav.menu')">
      <i ref="pill" class="nbi" style="transform-origin:0 0" />
      <Logo shuffle />
      <button v-for="p in NAV" :key="p.name" type="button" class="nb" :class="{ on: page === p.name }" :aria-current="page === p.name ? 'page' : undefined" @click="go(p.name)">
        <span class="ic"><Icon :name="p.icon" :size="22" /></span>{{ t(p.label) }}
      </button>
      <div class="navb">
        <UpdateButton />
        <button id="themeBtn" type="button" class="nb" @click.stop="appearanceOpen = !appearanceOpen"><span class="ic"><Icon name="palette" :size="22" /></span>{{ t("nav.appearance") }}</button>
      </div>
    </nav>
    <!-- no "appear": the first page is there at the first paint, without fading in -->
    <main><Transition name="page" mode="out-in"><component :is="PAGES[page]" :key="page" /></Transition></main>
  </div>
</template>
