<script setup lang="ts">
// Stored variables (from "x = 5" or "Save answer as"): tap one to type its name, the bin forgets it. Loaded on first open.
import { computed, ref } from "vue";
import { FUNCTIONS } from "@calc/core";
import { calc, current, press, show, valueText } from "../core/calc";
import { toast } from "../core/toast";
import Sheet from "./Sheet.vue";
import Icon from "./Icon.vue";

const emit = defineEmits<{ close: [] }>();
const list = computed(() => Object.entries(calc.vars).sort(([a], [b]) => a.localeCompare(b)));
const name = ref("");
const answer = computed(current);
const RESERVED = new Set(["ans", "e", "pi", "π", "mod"]);
const nameError = computed(() => {
  const n = name.value.trim();
  if (!n) return "";
  if (!/^[\p{L}_]+$/u.test(n)) return "Letters only";
  if (FUNCTIONS.has(n) || RESERVED.has(n)) return `${n} is taken`;
  return "";
});

function use(n: string) { press("fn:" + n); emit("close"); }
function save() {
  const n = name.value.trim(), a = answer.value;
  if (!n || nameError.value || !a) return;
  calc.vars[n] = a.exact;
  toast(`${n} = ${show(a.value)}`);
  name.value = "";
}
</script>

<template>
  <Sheet title="Variables" @close="emit('close')">
    <div v-if="list.length" class="vlist">
      <div v-for="[n, v] in list" :key="n" class="li click" role="button" tabindex="0" @click="use(n)" @keydown.enter="use(n)">
        <div class="grow"><span class="vname">{{ n }}</span> = <span class="num">{{ show(valueText(v)) }}</span></div>
        <button type="button" class="ib sm plain" :aria-label="`Forget ${n}`" @click.stop="delete calc.vars[n]"><Icon name="trash" :size="18" /></button>
      </div>
    </div>
    <div v-else class="empty sm">No variables yet. Type a name, = and a value (x = 5), or save the answer below.</div>
    <form class="vsave" @submit.prevent="save">
      <div class="fld grow"><label for="vname">Save the answer{{ answer ? ` (${show(answer.value)})` : "" }} as</label><input id="vname" v-model="name" autocomplete="off" spellcheck="false" placeholder="x" /></div>
      <button type="submit" class="btn" :disabled="!name.trim() || !!nameError || !answer">Save</button>
    </form>
    <div v-if="nameError" class="sm verr">{{ nameError }}</div>
  </Sheet>
</template>
