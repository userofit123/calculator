<script setup lang="ts">
// The app mark (core/mark.ts) on the accent gradient; the browser tab shows the same tile. Clicking it on the rail picks a random look, as in Money Manager.
import { ref } from "vue";
import { shuffle as doShuffle } from "../core/theme";
import { t } from "../core/i18n";
import { MARK } from "../core/mark";
const props = defineProps<{ shuffle?: boolean }>();
const el = ref<HTMLElement | null>(null);
const click = () => { if (props.shuffle) doShuffle(el.value); };
</script>

<template>
  <div ref="el" class="logo" :class="{ click: shuffle }" :title="shuffle ? t('nav.shuffle') : undefined" @click="click">
    <svg viewBox="0 0 24 24"><path fill="currentColor" :d="MARK" /></svg>
  </div>
</template>
