<script setup lang="ts">
// The frame: the desktop or the phone layout (decided before the first paint by index.html, kept up to date by
// core/device.ts), the Appearance panel (loaded on its first open) and the toasts.
import { defineAsyncComponent, ref, watch } from "vue";
import { isPhone } from "./core/device";
import { appearanceOpen } from "./core/ui";
import DesktopShell from "./shell/DesktopShell.vue";
import PhoneShell from "./shell/PhoneShell.vue";
import Toasts from "./components/Toasts.vue";

const AppearancePanel = defineAsyncComponent(() => import("./shell/AppearancePanel.vue"));
const apLoaded = ref(false);
watch(appearanceOpen, (o) => { if (o) apLoaded.value = true; });
</script>

<template>
  <PhoneShell v-if="isPhone" />
  <DesktopShell v-else />
  <AppearancePanel v-if="apLoaded" />
  <Toasts />
</template>
