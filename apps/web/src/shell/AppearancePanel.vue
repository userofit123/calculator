<script setup lang="ts">
// The Appearance panel (ported from Motus / Money Manager): mode, colour set, background, texture, surface, corners, font,
// the calculator's keys (shape, press feedback), density, spacing, navigation, and saved looks. Chart colours are left out:
// the calculator draws no charts yet. Styled by styles/components/appearance.css.
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { theme, ATM, ST0, AKEYS, BGS, FONTS, looks, lookFor, saveLooks, copy, isDark, atmOf, custVal, lookPal, setTheme, themeSwap, PKEYS, known, type Theme } from "../core/theme";
import { appearanceOpen } from "../core/ui";
import { sheetOpened, sheetClosed } from "../core/sheets";
import { isPhone } from "../core/device";
import { lockScroll } from "../core/scrollLock";
import { usePullDown } from "../core/pullDown";
import { toast } from "../core/toast";
import { t, tMaybe, type Key, useTexts } from "../core/i18n";
import { look as texts } from "../i18n/en/look";
// this part loads lazily: its English texts come with it
useTexts(texts);
import AppSelect from "../components/AppSelect.vue";
import ColorPicker from "../components/ColorPicker.vue";
// the panel's own styles load with it, keeping them out of the first screen's CSS
import "../styles/components/appearance.css";

const tab = ref("col");
// labels are keys, worded when shown so they follow the language
const TABS: Record<string, Key> = { col: "look.tab.col", bg: "look.tab.bg", sty: "look.tab.sty", lay: "look.tab.lay", sav: "look.tab.sav" };
const k = computed<"L" | "D">(() => (isDark() ? "D" : "L"));
const dark = computed(() => k.value === "D");
const out = ref(false);
// Back closes it like any sheet, instead of leaving the page behind it
let backId = 0, unlock = () => {};
// the keyboard goes into the panel when it opens (onto the chosen tab) and back to where it was when it closes
let before: HTMLElement | null = null;
watch(appearanceOpen, (o) => {
  unlock();
  if (o) {
    before = document.activeElement as HTMLElement | null;
    nextTick(() => el.value?.querySelector<HTMLElement>('#apTabs [aria-selected="true"]')?.focus({ preventScroll: true }));
  } else if (before?.isConnected && (el.value?.contains(document.activeElement) || document.activeElement === document.body)) { before.focus({ preventScroll: true }); before = null; }
  if (o) { backId = sheetOpened(() => (appearanceOpen.value = false)); if (isPhone.value) unlock = lockScroll(); } // phone only: a bottom sheet with a scrim; on a computer the lock would shift fixed elements by the scrollbar width
  else {
    unlock = () => {};
    if (!backId) return; // never opened
    sheetClosed(backId); backId = 0;
    if (pull.pulledAway) return; // it already slid away under the finger
    out.value = true; setTimeout(() => (out.value = false), 200);
  }
}, { immediate: true }); // the panel loads on its first open (App.vue), already open by then
const close = () => { appearanceOpen.value = false; };
const el = ref<HTMLElement | null>(null);
// on the phone it is a bottom sheet: pull it down to close, like the others
const pull = usePullDown(() => el.value, () => document.querySelector<HTMLElement>(".apscr"), () => appearanceOpen.value, close);
const outside = (e: Event) => { if (appearanceOpen.value && el.value && !el.value.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("#themeBtn,[data-theme-open]")) close(); };
const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && appearanceOpen.value && !document.querySelector(".scr:not(.apscr):not(.leaving)")) close(); };
// the tabs: arrows move between them (and show the one moved to), as tabs do
function tabKey(e: KeyboardEvent) {
  const ks = Object.keys(TABS), i = ks.indexOf(tab.value);
  // right to left the tabs run the other way, so the arrows follow what is on screen
  const fw = el.value && getComputedStyle(el.value).direction === "rtl" ? -1 : 1;
  const to = { ArrowRight: i + fw, ArrowLeft: i - fw, Home: 0, End: ks.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault(); tab.value = ks[(to + ks.length) % ks.length]!;
  nextTick(() => el.value?.querySelector<HTMLElement>('#apTabs [aria-selected="true"]')?.focus());
}
onMounted(() => { document.addEventListener("click", outside, true); addEventListener("keydown", esc); });
onBeforeUnmount(() => { unlock(); document.removeEventListener("click", outside, true); removeEventListener("keydown", esc); });

const TEX = ["none", "dots", "stripes", "grid", "static"];
const SURF = ["solid", "outline", "raised", "glass"];
// [setting, min, max, step, default, unit]; label "look.glass.<setting>", hint "look.glassHint.<setting>"
const GLASS: [NumKey, number, number, number, number, string][] = [
  ["gbl", 0, 100, 5, 50, "%"],
  ["gsat", 50, 250, 10, 140, "%"],
  ["gop", 0, 100, 5, 55, "%"],
];
const gval = (g: (typeof GLASS)[number]) => (theme[g[0]] == null ? g[4] : +(theme[g[0]] as number));
const RAD: [string, number][] = [["round", 18], ["soft", 9], ["sharp", 2]];
const FNT = ["sans", "serif", "round", "mono"];
const KSH = ["corners", "round"];
const KFB = ["press", "glow", "none"];
const DEN: [string, number][] = [["compact", 3], ["cozy", 6], ["roomy", 10]];
const SPC: [string, number][] = [["tight", 2], ["standard", 5], ["loose", 9], ["wide", 13]];
const NSP: [string, number][] = [["tight", 2], ["standard", 5], ["roomy", 8]];
const CGROUPS: [Key, string[]][] = [["look.cg.main", ["acc", "acc2", "accc"]], ["look.cg.on", ["on", "onc"]], ["look.cg.page", ["bg", "tx"]], ["look.cg.results", ["pos", "neg"]]];
/** a choice's name: "look.<group>.<id>" (the ids stay as they are saved) */
const L = (group: string, id: string) => tMaybe(`look.${group}.${id}`, id);
const presets = computed(() => Object.keys(ATM).map((n) => ({ value: n, label: L("atm", n) })));

const opt = (key: keyof Theme, v: unknown) => setTheme({ [key]: v } as Partial<Theme>);
const swatch = (n: string) => { const c = n === "Custom" ? atmOf("Custom")[k.value] : ATM[n]![k.value]; return `linear-gradient(135deg,${c[0]} 0 52%,${c[4]} 52% 100%)`; };
// the settings a slider moves (all plain numbers)
type NumKey = { [K in keyof Theme]: Theme[K] extends number ? K : never }[keyof Theme];
const range = (key: NumKey, v: string) => { theme[key] = +v; };
const fromPreset = (n: string) => {
  const a = ATM[n]; if (!a) return;
  const cu: Record<string, Record<string, string>> = { L: {}, D: {} };
  (["L", "D"] as const).forEach((m) => AKEYS.forEach((x, j) => { cu[m]![x] = a[m][j]!; }));
  setTheme({ cc: a.L[0], cu, atm: "Custom" });
};
const setBase = (v: string) => Object.assign(theme, { cc: v, atm: "Custom", cu: { L: {}, D: {} } });
const setCust = (n: string, v: string) => { const cu = copy(theme.cu || { L: {}, D: {} }); (cu[k.value] = cu[k.value] || {})[n] = v; Object.assign(theme, { cu, atm: "Custom" }); };
const custReset = () => setTheme({ cu: { L: {}, D: {} }, cc: ST0.cc });
const reset = () => themeSwap(() => { const keep = { ls: theme.ls }; (Object.keys(theme) as (keyof Theme)[]).forEach((x) => delete theme[x]); Object.assign(theme, copy(ST0), keep); });

const lookName = ref(""), nameEl = ref<HTMLInputElement | null>(null);
const snap = () => copy(Object.fromEntries(PKEYS.map((x) => [x, theme[x]]))) as Partial<Theme>;
const openSave = () => { tab.value = "sav"; nextTick(() => nameEl.value?.focus()); };
function saveLook() {
  const nm = lookName.value.trim();
  if (!nm) { nameEl.value?.focus(); return; }
  if (looks.value.length >= 25) { toast(t("look.max"), { kind: "err" }); return; }
  looks.value = [...looks.value, { id: Date.now().toString(36), name: nm, v: snap() }];
  lookName.value = ""; saveLooks();
}
const useLook = (x: { v: Partial<Theme> }) => setTheme(known(copy(x.v)));
function assign(x: { id: string }, sc: "L" | "D") {
  lookFor.value = { ...lookFor.value, [sc]: lookFor.value[sc] === x.id ? null : x.id }; saveLooks();
  const y = looks.value.find((z) => z.id === lookFor.value[sc]);
  if (y && (sc === "D") === isDark()) setTheme(known(copy(y.v)));
}
const updLook = (x: { id: string; name: string }) => { looks.value = looks.value.map((y) => (y.id === x.id ? { ...y, v: snap() } : y)); saveLooks(); toast(t("look.updated", { name: x.name })); };
const delLook = (x: { id: string }) => { looks.value = looks.value.filter((y) => y.id !== x.id); const a = { ...lookFor.value }; (["L", "D"] as const).forEach((s) => { if (a[s] === x.id) a[s] = null; }); lookFor.value = a; saveLooks(); };
const lookDot = (x: { v: Partial<Theme> }) => { const c = lookPal(x.v, k.value); return `background:linear-gradient(135deg,${c[0]} 0 50%,${c[4]} 50% 100%);box-shadow:0 0 0 3px ${c[3]},0 0 0 4px var(--ol)`; };
</script>

<template>
  <!-- on the phone it's a bottom sheet over a scrim, like the other sheets; a tap on the scrim closes it -->
  <div v-if="isPhone && appearanceOpen" class="scr apscr" aria-hidden="true" />
  <div id="pop" ref="el" class="pop" :class="{ on: appearanceOpen, out }" role="dialog" aria-labelledby="apTitle" :aria-modal="isPhone ? 'true' : undefined" :inert="!appearanceOpen || undefined">
    <div class="aph"><b id="apTitle" role="heading" aria-level="2">{{ t("nav.appearance") }}</b><span class="aphb"><button class="btn o s" @click="openSave">{{ t("look.saveDots") }}</button><button class="btn o s" @click="reset">{{ t("look.reset") }}</button></span></div>
    <div id="apTabs" class="seg apseg aptabs" role="tablist" :aria-label="t('look.sections')" @keydown="tabKey">
      <button v-for="(l, x) in TABS" :id="`apTab-${x}`" :key="x" type="button" role="tab" :aria-selected="tab === x" aria-controls="apBody" :tabindex="tab === x ? 0 : -1" :class="{ on: tab === x }" @click="tab = x">{{ t(l) }}</button>
    </div>
    <div id="apBody" class="apb" role="tabpanel" :aria-labelledby="`apTab-${tab}`">
      <div class="apbt" :class="{ on: tab === 'col' }">
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.mode") }}</h4>
          <div class="seg apseg">
            <button :class="{ on: theme.mode === 'light' }" :aria-pressed="theme.mode === 'light'" @click="opt('mode', 'light')">{{ t("look.light") }}</button>
            <button :class="{ on: theme.mode === 'dark' }" :aria-pressed="theme.mode === 'dark'" @click="opt('mode', 'dark')">{{ t("look.dark") }}</button>
            <button :class="{ on: theme.mode === 'auto' }" :aria-pressed="theme.mode === 'auto'" @click="opt('mode', 'auto')">{{ t("lang.auto") }}</button>
          </div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.palette") }}</h4>
          <div class="sw">
            <button v-for="(_, n) in ATM" :key="n" :class="{ on: theme.atm === n }" :aria-pressed="theme.atm === n" :title="L('atm', String(n))" @click="opt('atm', n)"><span class="swd" :style="{ background: swatch(String(n)) }" /><span class="swn">{{ L("atm", String(n)) }}</span></button>
            <button :class="{ on: theme.atm === 'Custom' }" :aria-pressed="theme.atm === 'Custom'" :title="t('look.customColour')" @click="opt('atm', 'Custom')"><span class="swd" :class="{ any: theme.atm !== 'Custom' }" :style="theme.atm === 'Custom' ? { background: swatch('Custom') } : undefined" /><span class="swn">{{ L("atm", "Custom") }}</span></button>
          </div>
        </div>
        <div v-if="theme.atm === 'Custom'" class="aps cust">
          <div class="cuh"><div><b>{{ t("look.own") }}</b><div class="sm">{{ t("look.ownHint") }}</div></div><button class="btn o s" @click="custReset">{{ t("look.reset") }}</button></div>
          <div class="cbase">
            <label class="cbc"><ColorPicker :model-value="theme.cc || ST0.cc" :title="t('look.base')" :aria-label="t('look.base')" @update:model-value="setBase" /></label>
            <div class="cbt"><b>{{ t("look.base") }}</b><span class="num">{{ (theme.cc || "").toUpperCase() }}</span></div>
            <AppSelect model-value="" :options="presets" :placeholder="t('look.preset')" :title="t('look.startFrom')" :aria-label="t('look.startFrom')" @update:model-value="fromPreset" />
          </div>
          <div class="cmode"><span class="cmd" :class="{ d: dark }" />{{ dark ? t("look.darkColours") : t("look.lightColours") }}<span class="sm">{{ t("look.otherSet") }}</span></div>
          <div v-for="[g, ns] in CGROUPS" :key="g" class="cgp">
            <h5>{{ t(g) }}</h5>
            <div class="cgrid"><label v-for="n in ns" :key="n" class="crow"><ColorPicker :model-value="custVal(n, k)" :title="L('c', n)" :aria-label="L('c', n)" @update:model-value="(v) => setCust(n, v)" /><span>{{ L("c", n) }}</span><output class="num">{{ custVal(n, k).toUpperCase() }}</output></label></div>
          </div>
        </div>
      </div>
      <div class="apbt" :class="{ on: tab === 'bg' }">
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.bg") }}</h4>
          <div class="apg c5"><button v-for="v in BGS" :key="v" class="apt" :class="{ on: theme.bg === v }" :aria-pressed="theme.bg === v" @click="opt('bg', v)"><span class="apv bgv" :class="'bg-' + v" /><span class="apl">{{ L("bg", v) }}</span></button></div>
          <div class="apr" :class="{ off: theme.bg === 'flat' }"><span>{{ t("look.gradient") }}</span><input type="range" min="0" max="200" step="5" :value="theme.gi ?? 100" @input="range('gi', ($event.target as HTMLInputElement).value)"><output class="num">{{ Math.round(theme.gi ?? 100) }}%</output></div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.tex") }}</h4>
          <div class="apg c5"><button v-for="v in TEX" :key="v" class="apt" :class="{ on: theme.tex === v }" :aria-pressed="theme.tex === v" @click="opt('tex', v)"><span class="apv txv" :class="'tx-' + v" /><span class="apl">{{ L("tex", v) }}</span></button></div>
          <div class="apsub" :class="{ off: theme.tex === 'none' }">
            <div class="apr"><span>{{ t("look.texDensity") }}</span><input type="range" min="40" max="240" step="10" :value="+theme.tsc || 100" @input="range('tsc', ($event.target as HTMLInputElement).value)"><output class="num">{{ Math.round(+theme.tsc || 100) }}%</output></div>
            <div class="apr"><span>{{ t("look.texOpacity") }}</span><input type="range" min="5" max="100" step="5" :value="theme.toa ?? 50" @input="range('toa', ($event.target as HTMLInputElement).value)"><output class="num">{{ Math.round(theme.toa ?? 50) }}%</output></div>
          </div>
        </div>
      </div>
      <div class="apbt" :class="{ on: tab === 'sty' }">
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.surface") }}</h4>
          <div class="apg c5"><button v-for="v in SURF" :key="v" class="apt" :class="{ on: theme.surf === v }" :aria-pressed="theme.surf === v" @click="opt('surf', v)"><span class="apv sfv" :class="'sf-' + v"><i /></span><span class="apl">{{ L("surf", v) }}</span></button></div>
          <div v-if="theme.surf === 'glass'" class="apsub">
            <div v-for="g in GLASS" :key="g[0]" class="apr"><span :title="L('glassHint', g[0])">{{ L("glass", g[0]) }}</span><input type="range" :min="g[1]" :max="g[2]" :step="g[3]" :value="gval(g)" @input="range(g[0], ($event.target as HTMLInputElement).value)"><output class="num">{{ Math.round(gval(g)) }}{{ g[5] }}</output></div>
          </div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.corners") }}</h4>
          <div class="apg"><button v-for="[v, r] in RAD" :key="v" class="apt" :class="{ on: theme.rad === v }" :aria-pressed="theme.rad === v" @click="opt('rad', v)"><span class="apv rv"><i :style="{ borderTopLeftRadius: r + 'px' }" /></span><span class="apl">{{ L("rad", v) }}</span></button></div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.keys") }}</h4>
          <div class="apg"><button v-for="v in KSH" :key="v" class="apt" :class="{ on: theme.ksh === v }" :aria-pressed="theme.ksh === v" @click="opt('ksh', v)"><span class="apv kpv" :class="'ks-' + v"><i /><i /><i /></span><span class="apl">{{ L("ksh", v) }}</span></button></div>
          <div class="apr"><span>{{ t("look.keyPress") }}</span><div class="seg apseg"><button v-for="v in KFB" :key="v" :class="{ on: theme.kfb === v }" :aria-pressed="theme.kfb === v" @click="opt('kfb', v)">{{ L("kfb", v) }}</button></div></div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.font") }}</h4>
          <div class="apg c4"><button v-for="v in FNT" :key="v" class="apt" :class="{ on: theme.fnt === v }" :aria-pressed="theme.fnt === v" @click="opt('fnt', v)"><span class="apv fv" :style="{ fontFamily: FONTS[v] }">Aa</span><span class="apl">{{ L("fnt", v) }}</span></button></div>
        </div>
      </div>
      <div class="apbt" :class="{ on: tab === 'lay' }">
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.density") }}</h4><div class="sm aph4">{{ t("look.densityHint") }}</div>
          <div class="apg"><button v-for="[v, g] in DEN" :key="v" class="apt" :class="{ on: theme.den === v }" :aria-pressed="theme.den === v" @click="opt('den', v)"><span class="apv dv" :style="{ '--g': g + 'px' }"><i /><i /><i /></span><span class="apl">{{ L("den", v) }}</span></button></div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.spacing") }}</h4>
          <div class="apg c4"><button v-for="[v, g] in SPC" :key="v" class="apt" :class="{ on: theme.spc === v }" :aria-pressed="theme.spc === v" @click="opt('spc', v)"><span class="apv spv" :style="{ '--g': g + 'px' }"><i /><i /><i /></span><span class="apl">{{ L("spc", v) }}</span></button></div>
        </div>
        <div class="aps only-d"><h4 role="heading" aria-level="3">{{ t("look.sideSpacing") }}</h4>
          <div class="apg c3"><button v-for="[v, g] in NSP" :key="v" class="apt" :class="{ on: theme.nsp === v }" :aria-pressed="theme.nsp === v" @click="opt('nsp', v)"><span class="apv spv sbv" :style="{ '--g': g + 'px' }"><i /><i /><i /><i /></span><span class="apl">{{ L("nsp", v) }}</span></button></div>
        </div>
        <div class="aps only-d"><h4 role="heading" aria-level="3">{{ t("look.nav") }}</h4>
          <div class="seg apseg"><button :class="{ on: theme.nav === 'full' }" :aria-pressed="theme.nav === 'full'" @click="opt('nav', 'full')">{{ t("look.navFull") }}</button><button :class="{ on: theme.nav === 'mini' }" :aria-pressed="theme.nav === 'mini'" @click="opt('nav', 'mini')">{{ t("look.navMini") }}</button></div>
        </div>
      </div>
      <div class="apbt" :class="{ on: tab === 'sav' }">
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.saveCurrent") }}</h4>
          <div class="apr apname"><input ref="nameEl" v-model="lookName" type="text" maxlength="30" :placeholder="t('look.name')" @keydown.enter="saveLook"><button class="btn s" @click="saveLook">{{ t("c.save") }}</button></div>
          <div class="sm apnote">{{ t("look.modeNote") }}</div>
        </div>
        <div class="aps"><h4 role="heading" aria-level="3">{{ t("look.yours") }}</h4>
          <div id="tpList">
            <div v-for="x in looks" :key="x.id" class="tpr">
              <span class="tpd" :style="lookDot(x)" /><b>{{ x.name }}</b>
              <span class="tpa">
                <button class="btn o s" @click="useLook(x)">{{ t("look.use") }}</button>
                <button class="btn o s" :class="{ on: lookFor.L === x.id }" :aria-pressed="lookFor.L === x.id" :title="t('look.useLight')" @click="assign(x, 'L')">{{ t("look.light") }}</button>
                <button class="btn o s" :class="{ on: lookFor.D === x.id }" :aria-pressed="lookFor.D === x.id" :title="t('look.useDark')" @click="assign(x, 'D')">{{ t("look.dark") }}</button>
                <button class="btn o s" :title="t('look.replace')" @click="updLook(x)">{{ t("look.update") }}</button>
                <button class="btn o s" :aria-label="t('c.delete')" @click="delLook(x)">×</button>
              </span>
            </div>
            <div v-if="!looks.length" class="sm">{{ t("look.none") }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
