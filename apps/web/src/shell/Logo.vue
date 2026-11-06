<script setup lang="ts">
// The app mark: the launcher icon's glyph (a solid calculator with the display and keys cut out) on the accent gradient. Clicking it on the rail picks a random look, as in Money Manager.
import { ref } from "vue";
import { shuffle as doShuffle } from "../core/theme";
import { t } from "../core/i18n";
const props = defineProps<{ shuffle?: boolean }>();
const el = ref<HTMLElement | null>(null);
const click = () => { if (props.shuffle) doShuffle(el.value); };
</script>

<template>
  <div ref="el" class="logo" :class="{ click: shuffle }" :title="shuffle ? t('nav.shuffle') : undefined" @click="click">
    <svg viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M8.59 3h6.71a2.59 2.59 0 0 1 2.59 2.59v12.81a2.59 2.59 0 0 1 -2.59 2.59h-6.71a2.59 2.59 0 0 1 -2.59 -2.59v-12.81a2.59 2.59 0 0 1 2.59 -2.59zM8.97 5.75h5.95a0.84 0.84 0 0 1 0.84 0.84v1.68a0.84 0.84 0 0 1 -0.84 0.84h-5.95a0.84 0.84 0 0 1 -0.84 -0.84v-1.68a0.84 0.84 0 0 1 0.84 -0.84zM8.14 11.47h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM11.49 11.47h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM14.85 11.47h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM8.14 14.67h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM11.49 14.67h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM14.85 14.67h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM8.14 17.87h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM11.49 17.87h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53zM14.85 17.87h0.92a0.53 0.53 0 0 1 0.53 0.53v0.92a0.53 0.53 0 0 1 -0.53 0.53h-0.92a0.53 0.53 0 0 1 -0.53 -0.53v-0.92a0.53 0.53 0 0 1 0.53 -0.53z" /></svg>
  </div>
</template>
