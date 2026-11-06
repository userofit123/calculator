<script setup lang="ts">
// The app mark: a small calculator on the accent gradient. Clicking it on the rail picks a random look, as in Money Manager.
import { ref } from "vue";
import { shuffle as doShuffle } from "../core/theme";
const props = defineProps<{ shuffle?: boolean }>();
const el = ref<HTMLElement | null>(null);
const click = () => { if (props.shuffle) doShuffle(el.value); };
</script>

<template>
  <div ref="el" class="logo" :class="{ click: shuffle }" :title="shuffle ? 'Surprise me with a new look' : undefined" @click="click">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M8.5 7.5h7" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" stroke-width="2.8" /></svg>
  </div>
</template>
