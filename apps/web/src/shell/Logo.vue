<script setup lang="ts">
// The app mark (core/mark.ts) on the accent gradient; the browser tab shows the same tile. Clicking it on the rail picks a random look, as in Money Manager.
import { ref } from "vue";
import { shuffle as doShuffle } from "../core/theme";
import { t } from "../core/i18n";
import { MARK } from "../core/mark";
const props = defineProps<{ shuffle?: boolean }>();
const el = ref<HTMLElement | null>(null);
const shake = ref(false);
let shakeTimer: ReturnType<typeof setTimeout> | undefined;
const click = () => {
  if (!props.shuffle) return;
  // restart the animation on every click, even a quick second one
  clearTimeout(shakeTimer);
  shake.value = false;
  requestAnimationFrame(() => { shake.value = true; shakeTimer = setTimeout(() => (shake.value = false), 520); });
  doShuffle(el.value);
};
</script>

<template>
  <div ref="el" class="logo" :class="{ click: shuffle, shake }" :title="shuffle ? t('nav.shuffle') : undefined" @click="click">
    <svg viewBox="0 0 24 24"><path fill="currentColor" :d="MARK" /></svg>
  </div>
</template>
