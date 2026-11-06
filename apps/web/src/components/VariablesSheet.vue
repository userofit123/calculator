<script setup lang="ts">
// Stored variables (from "x = 5" or "Save answer as"): tap one to type its name, the bin forgets it. Loaded on first open.
import { computed, ref } from "vue";
import { FUNCTIONS, RESERVED } from "@calc/core";
import { calc, current, press, show, valueText } from "../core/calc";
import { toast } from "../core/toast";
import Sheet from "./Sheet.vue";
import Icon from "./Icon.vue";
import { t } from "../core/i18n";

const emit = defineEmits<{ close: [] }>();
const list = computed(() => Object.entries(calc.vars).sort(([a], [b]) => a.localeCompare(b)));
const name = ref("");
const answer = computed(current);
const nameError = computed(() => {
  const n = name.value.trim();
  if (!n) return "";
  if (!/^[\p{L}_]+$/u.test(n)) return t("kbd.varLetters");
  if (FUNCTIONS.has(n) || RESERVED.has(n)) return t("kbd.varTaken", { n });
  if (n.includes("π")) return t("kbd.varPi"); // aπ reads as a × π
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
  <Sheet :title="t('kbd.vars')" @close="emit('close')">
    <TransitionGroup v-if="list.length" tag="div" name="row" class="vlist">
      <div v-for="[n, v] in list" :key="n" class="li click" role="button" tabindex="0" @click="use(n)" @keydown.enter="use(n)">
        <div class="grow"><span class="vname">{{ n }}</span> = <span class="num">{{ show(valueText(v)) }}</span></div>
        <button type="button" class="ib sm plain" :aria-label="t('kbd.varForget', { n })" @click.stop="delete calc.vars[n]"><Icon name="trash" :size="18" /></button>
      </div>
    </TransitionGroup>
    <div v-else class="empty sm">{{ t("kbd.varsEmpty", { ex: "x = 5" }) }}</div>
    <form class="vsave" @submit.prevent="save">
      <div class="fld grow"><label for="vname">{{ answer ? t("kbd.varSaveAs", { v: show(answer.value) }) : t("kbd.varSaveAnswer") }}</label><input id="vname" v-model="name" autocomplete="off" spellcheck="false" placeholder="x" /></div>
      <button type="submit" class="btn" :disabled="!name.trim() || !!nameError || !answer">{{ t("c.save") }}</button>
    </form>
    <div v-if="nameError" class="sm verr">{{ nameError }}</div>
  </Sheet>
</template>
