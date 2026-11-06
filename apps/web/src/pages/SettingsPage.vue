<script setup lang="ts">
// Settings: Appearance (the panel, and phone or computer layout), the calculator's own options (angles, decimals,
// number format, decimal mark, grouping; later units), and
// About with the privacy promise.
import { appearanceOpen } from "../core/ui";
import { layoutChoice, setLayout } from "../core/device";
import { settings, ANGLES, FORMATS, fmtLabel, fmtHint } from "../core/calc";
import { t, locale, langChoice, setLang, type LangChoice, useTexts } from "../core/i18n";
import { settings as texts } from "../i18n/en/settings";
// this part loads lazily: its English texts come with it
useTexts(texts);
import { tMsg } from "../core/msg";
import { computed } from "vue";
import Icon from "../components/Icon.vue";
import AppSelect from "../components/AppSelect.vue";
// --- History (C-26) ---
import { ref } from "vue";
import { histPrefs, history, setKeepHistory } from "../core/history";
import Sheet from "../components/Sheet.vue";
const askOff = ref(false);
/** Off asks first when there is a history to keep or delete */
function keepChange(e: Event) {
  const on = (e.target as HTMLInputElement).checked;
  if (on || !history.length) return setKeepHistory(on);
  (e.target as HTMLInputElement).checked = true; askOff.value = true;
}
function turnOff(del: boolean) { askOff.value = false; setKeepHistory(false, del); }
// --- end History ---
// --- Converter / Currency rates (C-14) ---
import { sourceDayOf } from "@calc/core";
import { rates, refreshRates } from "../core/rates";
// core/rates.ts's rateDate words the month in English; here it follows the language shown
const rateDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// --- end Converter / Currency rates ---

// --- Updates (C-27) ---
import { appUpdates, upd, checkNow, download, install, setAuto } from "../core/appUpdate";
const inApp = appUpdates();
const onDesktop = !!(globalThis as { calcUpdate?: unknown }).calcUpdate;
const when = (ms: number) => new Date(ms).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
/** the release page (deb/rpm): a link, which the desktop app opens in the browser (its allowlist has this repository) */
const openPage = () => { if (upd.page) window.open(upd.page, "_blank", "noopener"); };
// --- end Updates ---

const version = import.meta.env.VITE_VERSION || "dev";
const DECIMALS = Array.from({ length: 16 }, (_, i) => ({ value: i, label: String(i) }));
const FORMAT_OPTIONS = computed(() => FORMATS.map((f) => ({ value: f.id, label: fmtLabel(f.id) })));
const MARKS = [".", ","] as const;
const LAYOUTS = [["auto", "set.layout.auto"], ["phone", "set.layout.phone"], ["desktop", "set.layout.desktop"]] as const satisfies readonly [typeof layoutChoice.value, string][];
// the language names are in their own language (lang= so a screen reader says them right)
const LANGS = [["auto", "lang.auto", undefined], ["en", "lang.en", "en"], ["he", "lang.he", "he"]] as const satisfies readonly [LangChoice, string, string | undefined][];
</script>

<template>
  <div class="page">
    <div class="ph"><div><h1>{{ t("nav.settings") }}</h1></div></div>
    <div class="stack">
      <section>
        <div class="sh first"><h2>{{ t("nav.appearance") }}</h2></div>
        <div class="card flush">
          <button type="button" class="li click lib" data-theme-open @click.stop="appearanceOpen = true">
            <Icon name="palette" /><div class="grow"><div class="t">{{ t("nav.appearance") }}</div><div class="s">{{ t("set.appearanceHint") }}</div></div><Icon name="right" />
          </button>
          <div class="li">
            <Icon name="device" /><div class="grow"><div class="t">{{ t("set.layout") }}</div><div class="s">{{ t("set.layoutHint") }}</div></div>
            <div class="seg"><button v-for="[v, l] in LAYOUTS" :key="v" type="button" :class="{ on: layoutChoice === v }" :aria-pressed="layoutChoice === v" @click="setLayout(v)">{{ t(l) }}</button></div>
          </div>
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("lang.title") }}</div><div class="s">{{ t("lang.hint") }}</div></div>
            <div class="seg"><button v-for="[c, k, l] in LANGS" :key="c" type="button" :lang="l" :class="{ on: langChoice === c }" :aria-pressed="langChoice === c" @click="setLang(c)">{{ t(k) }}</button></div>
          </div>
        </div>
      </section>
      <section>
        <div class="sh"><h2>{{ t("app.name") }}</h2></div>
        <div class="card flush">
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.angle") }}</div><div class="s">{{ t("set.angleHint") }}</div></div>
            <div class="seg"><button v-for="a in ANGLES" :key="a.id" type="button" :class="{ on: settings.angle === a.id }" :aria-pressed="settings.angle === a.id" @click="settings.angle = a.id">{{ a.label }}</button></div>
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.decimals") }}</div><div class="s">{{ t("set.decimalsHint") }}</div></div>
            <AppSelect v-model="settings.decimals" :options="DECIMALS" :title="t('set.decimals')" />
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.format") }}</div><div class="s">{{ t("set.formatHint", { hint: fmtHint(settings.format) }) }}</div></div>
            <AppSelect v-model="settings.format" :options="FORMAT_OPTIONS" :title="t('set.format')" />
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.mark") }}</div><div class="s num">{{ settings.decimalMark === "," ? "1.234,5" : "1,234.5" }}</div></div>
            <div class="seg"><button v-for="m in MARKS" :key="m" type="button" :class="{ on: settings.decimalMark === m }" :aria-pressed="settings.decimalMark === m" @click="settings.decimalMark = m">{{ m === "." ? t("set.mark.point") : t("set.mark.comma") }}</button></div>
          </div>
          <label class="li tg">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.thousands") }}</div><div class="s num">{{ settings.decimalMark === "," ? "1.000.000" : "1,000,000" }}</div></div>
            <input v-model="settings.thousands" type="checkbox" />
          </label>
          <label class="li tg">
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.everyday") }}</div><div class="s">{{ t("set.everydayHint") }}</div></div>
            <input v-model="settings.everyday" type="checkbox" />
          </label>
        </div>
      </section>
      <!-- History (C-26) -->
      <section>
        <div class="sh"><h2>{{ t("nav.history") }}</h2></div>
        <div class="card flush">
          <label class="li tg">
            <Icon name="history" /><div class="grow"><div class="t">{{ t("set.keepHistory") }}</div><div class="s">{{ t("set.keepHistoryHint") }}</div></div>
            <input :checked="histPrefs.keep" type="checkbox" @change="keepChange" />
          </label>
        </div>
        <Sheet v-if="askOff" :title="t('set.stopHistory')" @close="askOff = false">
          <p>{{ t("set.stopHistoryAsk", { n: history.length }) }}</p>
          <div class="seg" style="margin-top: var(--hg)"><button type="button" @click="turnOff(false)">{{ t("set.keepThem") }}</button><button type="button" @click="turnOff(true)">{{ t("set.deleteThem") }}</button></div>
        </Sheet>
      </section>
      <!-- end History -->
      <!-- Converter / Currency rates (C-14) -->
      <section>
        <div class="sh"><h2>{{ t("set.rates") }}</h2></div>
        <div class="card flush">
          <label class="li tg">
            <Icon name="convert" /><div class="grow"><div class="t">{{ t("set.ratesOnline") }}</div><div class="s">{{ t("set.ratesOnlineHint") }}</div></div>
            <input v-model="rates.online" type="checkbox" />
          </label>
          <div class="li">
            <Icon name="history" /><div class="grow"><div class="t">{{ t("set.ratesOf", { date: rateDate(sourceDayOf(rates.set, "ecb") || rates.set.date) }) }}</div>
              <div class="s">{{ t("set.ecbSource") }} · {{ rates.loading ? t("set.checking") : rates.error ? tMsg(rates.error)
                : rates.set.fetchedAt ? t("set.downloadedAt", { when: when(rates.set.fetchedAt) }) : t("set.cameWithApp") }}</div></div>
            <button type="button" class="btn o s" :disabled="!rates.online || rates.loading" @click="refreshRates()">{{ t("set.refreshNow") }}</button>
          </div>
        </div>
      </section>
      <!-- end Converter / Currency rates -->
      <!-- Updates (C-27) -->
      <section id="updates">
        <div class="sh"><h2>{{ t("set.updates") }}</h2></div>
        <div v-if="inApp" class="card flush">
          <label class="li tg">
            <Icon name="download" /><div class="grow"><div class="t">{{ t("set.autoUpdate") }}</div><div class="s">{{ t("set.autoUpdateHint") }}</div></div>
            <input :checked="upd.auto" type="checkbox" @change="setAuto(($event.target as HTMLInputElement).checked)" />
          </label>
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("set.version", { v: upd.current || version }) }}</div>
              <div class="s">{{ upd.checking ? t("set.checking") : upd.error ? tMsg(upd.error) : tMsg(upd.status) || (upd.lastCheck ? t("set.upToDate") : t("set.notChecked")) }}{{ upd.lastCheck && !upd.checking ? " · " + t("set.checkedAt", { when: when(upd.lastCheck) }) : "" }}</div></div>
            <button type="button" class="btn o s" :disabled="upd.checking || upd.downloading" @click="checkNow()">{{ t("set.checkNow") }}</button>
          </div>
          <template v-if="upd.latest">
            <div class="li">
              <Icon name="download" /><div class="grow"><div class="t">{{ t("set.version", { v: upd.latest }) }}</div>
                <div class="s">{{ upd.mode === "link" ? t("set.linkHint") : upd.ready ? t("set.downloaded") : upd.downloading ? tMsg(upd.status) : t("set.downloadHint") }}</div></div>
              <button v-if="upd.mode === 'link'" type="button" class="btn s" @click="openPage">{{ t("set.releasePage") }}</button>
              <button v-else-if="!upd.ready" type="button" class="btn s" :disabled="upd.downloading" @click="download()">{{ upd.downloading ? (upd.progress != null ? t("set.pct", { p: Math.round(upd.progress * 100) }) : t("msg.downloading")) : t("set.download") }}</button>
              <button v-else type="button" class="btn s" @click="install()">{{ onDesktop ? t("set.restartInstall") : t("set.install") }}</button>
            </div>
            <div v-if="upd.notes" class="li"><div class="grow"><div class="t">{{ t("set.whatsNew") }}</div><div class="s" style="white-space: pre-wrap">{{ upd.notes }}</div></div></div>
          </template>
        </div>
        <div v-else class="card about"><p>{{ t("set.webUpdates") }}</p></div>
      </section>
      <!-- end Updates -->
      <section>
        <div class="sh"><h2>{{ t("set.about") }}</h2></div>
        <div class="card about">
          <p><b>{{ t("app.name") }}</b> · {{ t("set.versionLower", { v: version }) }}</p>
          <p>{{ t("set.privacy") }}</p>
          <p>{{ t("set.source") }} <bdi>github.com/userofit123/calculator (PolyForm Noncommercial 1.0.0)</bdi></p>
        </div>
      </section>
    </div>
  </div>
</template>
