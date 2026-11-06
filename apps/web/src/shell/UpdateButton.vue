<script setup lang="ts">
// Shows only in the desktop and Android apps, and only when a newer version was found (Motus's UpdateButton): no badge
// otherwise. A click opens Settings at Updates, where the notes are and Download / Install is. In the rail on a
// computer, a slim row above the tabs on a phone. Also starts the automatic checks (once, whichever shell mounts first).
import { nextTick } from "vue";
import { upd, startAppUpdates } from "../core/appUpdate";
import { go } from "./nav";
import Icon from "../components/Icon.vue";
defineProps<{ phone?: boolean }>();
startAppUpdates();
function open() {
  go("settings");
  // the settings page loads lazily: look for the section a few times while it appears
  let n = 0;
  const find = () => { const el = document.getElementById("updates"); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); else if (n++ < 20) setTimeout(find, 50); };
  void nextTick(find);
}
</script>

<template>
  <template v-if="upd.latest">
    <button v-if="phone" type="button" class="updrow" @click="open">
      <Icon name="download" :size="18" /><span class="grow">{{ upd.ready ? `Version ${upd.latest} is ready to install` : `Version ${upd.latest} is available` }}</span><b>Update</b>
    </button>
    <button v-else type="button" class="nb upd" :title="`Version ${upd.latest} is available`" :aria-label="`Update: version ${upd.latest} is available`" @click="open">
      <span class="ic"><Icon name="download" :size="22" /></span>Update
    </button>
  </template>
</template>

<style scoped>
.updrow { display: flex; align-items: center; gap: var(--lpy); width: 100%; border: 0; border-bottom: 1px solid var(--ol); background: none; color: var(--tx); padding: var(--lpy) var(--cpx); font-size: 13px; cursor: pointer; text-align: left; }
.updrow .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx2); }
.updrow b { color: var(--acc); }
.upd .ic { color: var(--acc); }
</style>
<style>
/* the dock is taller while the update row shows: the page keeps clear of it */
.pshell.hasupd { padding-bottom: calc(var(--tabh) + var(--pdock) + var(--sb) + 2 * var(--lpy) + 20px); }
</style>
