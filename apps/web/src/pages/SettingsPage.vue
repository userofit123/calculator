<script setup lang="ts">
// Settings: Appearance (the panel, and phone or computer layout), the calculator's own options (angles, decimals,
// number format, decimal mark, grouping, the mode shortcuts; later units), and
// About with the privacy promise.
import { appearanceOpen } from "../core/ui";
import { layoutChoice, setLayout } from "../core/device";
import { settings, ANGLES, FORMATS, fmtLabel, fmtHint, MODES, modeLabel, modeHint, shortcuts, toggleShortcut, moveShortcut } from "../core/calc";
import { t, lang, locale, langChoice, setLang, resolveLang, type LangChoice, useTexts } from "../core/i18n";
import { LANGS, LANG_INFO } from "../i18n/langs";
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

// --- App & updates (C-27, C-52: Motus's App & Versions) ---
import { appUpdates, onAndroid, upd, checkNow, download, install, setAuto, setEvery, setAutoDownload, setWifiOnly, askNotify, refreshNotify, EVERY_CHOICES, type Every } from "../core/appUpdate";
import { pctOf, REPO_URL } from "../core/releases";
import { webUpd, checkWebNow, restartWeb } from "../core/update";
const inApp = appUpdates();
const isAndroid = onAndroid();
const onDesktop = !!(globalThis as { calcUpdate?: unknown }).calcUpdate;
if (isAndroid) void refreshNotify();
const when = (ms: number) => new Date(ms).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
/** a GitHub page (the release, all releases, the repository): a link, which the desktop app opens in the browser (its
 *  allowlist has this repository) and the Android app in the phone's browser */
const openUrl = (u: string) => { if (u) window.open(u, "_blank", "noopener"); };
const EVERY_OPTIONS = computed(() => EVERY_CHOICES.map((v) => ({ value: v, label: t(`set.every.${v}` as const) })));
/** what kind of copy this is: "Android app", "Desktop app (AppImage)", "Web app", ... */
const KINDS: Record<string, "set.kind.android" | "set.kind.appimage" | "set.kind.windows" | "set.kind.package" | "set.kind.dev"> = { android: "set.kind.android", AppImage: "set.kind.appimage", Windows: "set.kind.windows", package: "set.kind.package", dev: "set.kind.dev" };
const kindLabel = computed(() => (!inApp ? t("set.kind.web") : KINDS[upd.kind] ? t(KINDS[upd.kind]!) : onDesktop ? t("set.kind.desktop") : t("set.kind.android")));
const updTitle = computed(() => (upd.checking ? t("set.checking") : upd.error ? tMsg(upd.error) : upd.latest ? (upd.ready ? t("upd.ready", { v: upd.latest }) : t("upd.available", { v: upd.latest }))
  : upd.status && !upd.status.endsWith("is the latest") ? tMsg(upd.status) : upd.lastCheck ? t("set.upToDate") : t("set.notChecked")));
const updHint = computed(() => {
  if (upd.downloading) return tMsg(upd.status);
  if (upd.latest && upd.mode === "link") return t("set.linkHint");
  if (upd.latest && upd.ready) return onDesktop ? (upd.autoDownload ? t("set.readyDesktopQuit") : t("set.readyDesktop")) : t("set.readyAndroid");
  if (upd.latest) return t("set.downloadHint");
  return upd.lastCheck ? t("set.checkedAtCap", { when: when(upd.lastCheck) }) : "";
});
/** The web app / PWA (C-52): Check now asks its service worker's server; the answer in the same row as the apps' */
const webTitle = computed(() => (webUpd.checking ? t("set.checking") : webUpd.state === "ready" ? t("set.webReady") : webUpd.state === "latest" ? t("set.upToDate")
  : webUpd.state === "error" ? t("set.checkFailed") : webUpd.state === "none" ? t("set.webNone") : t("set.webSelf")));
const webHint = computed(() => (webUpd.checking ? "" : webUpd.state === "ready" ? t("set.webReadyHint") : webUpd.state === "error" ? t("set.checkFailedHint")
  : webUpd.state === "none" ? t("set.webNoneHint") : upd.lastCheck ? t("set.checkedAtCap", { when: when(upd.lastCheck) }) : t("set.webUpdates")));
const checkAny = () => (inApp ? checkNow() : checkWebNow());
// --- end App & updates ---

const version = import.meta.env.VITE_VERSION || "dev";
const DECIMALS = Array.from({ length: 16 }, (_, i) => ({ value: i, label: String(i) }));
const FORMAT_OPTIONS = computed(() => FORMATS.map((f) => ({ value: f.id, label: fmtLabel(f.id) })));
const MARKS = [".", ","] as const;
/** C-66: the modes not yet a shortcut, in the mode menu's order */
const notShortcut = computed(() => MODES.filter((m) => !shortcuts.modes.includes(m.id)));
const LAYOUTS = [["auto", "set.layout.auto"], ["phone", "set.layout.phone"], ["desktop", "set.layout.desktop"]] as const satisfies readonly [typeof layoutChoice.value, string][];
// Each language by its own name (lang= so a screen reader says it right), with its name in the language shown under it
// (typing its first letters jumps to it); Auto shows which one it means now.
function inShown(locale: string): string {
  try { return new Intl.DisplayNames([LANG_INFO[lang.value].locale], { type: "language" }).of(locale.replace(/-u-.*$/, "")) ?? ""; } catch { return ""; }
}
const LANG_OPTIONS = computed(() => [
  { value: "auto" as LangChoice, label: t("lang.auto"), hint: LANG_INFO[resolveLang("auto")].name },
  ...LANGS.map((l) => {
    const h = inShown(l.locale);
    return { value: l.code as LangChoice, label: l.name, lang: l.locale.replace(/-u-.*$/, ""), hint: h && h.toLocaleLowerCase() !== l.name.toLocaleLowerCase() ? h : undefined };
  }),
]);
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
            <AppSelect :model-value="langChoice" :options="LANG_OPTIONS" :title="t('lang.title')" @update:model-value="setLang" />
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
            <Icon name="calc" /><div class="grow"><div class="t">{{ t("set.shortcuts") }}</div><div class="s">{{ t("set.shortcutsHint") }}</div></div>
            <input v-model="shortcuts.on" type="checkbox" />
          </label>
          <template v-if="shortcuts.on">
            <div v-for="(m, i) in shortcuts.modes" :key="m" class="li scli">
              <Icon name="calc" class="scgap" aria-hidden="true" />
              <div class="grow"><div class="t">{{ modeLabel(m) }}</div><div class="s">{{ modeHint(m) }}</div></div>
              <button type="button" class="ib sm plain" :disabled="i === 0" :title="t('set.scEarlier', { x: modeLabel(m) })" :aria-label="t('set.scEarlier', { x: modeLabel(m) })" @click="moveShortcut(m, -1)"><Icon name="up" /></button>
              <button type="button" class="ib sm plain" :disabled="i === shortcuts.modes.length - 1" :title="t('set.scLater', { x: modeLabel(m) })" :aria-label="t('set.scLater', { x: modeLabel(m) })" @click="moveShortcut(m, 1)"><Icon name="down" /></button>
              <button type="button" class="ib sm plain" :title="t('set.scRemove', { x: modeLabel(m) })" :aria-label="t('set.scRemove', { x: modeLabel(m) })" @click="toggleShortcut(m)"><Icon name="close" /></button>
            </div>
            <div v-if="notShortcut.length" class="li scli scadd">
              <Icon name="calc" class="scgap" aria-hidden="true" />
              <div class="grow"><div class="t">{{ t("set.scAdd") }}</div><div class="s">{{ t(shortcuts.modes.length ? "set.scAddHint" : "set.scNone") }}</div></div>
              <div class="scpick" role="group" :aria-label="t('set.scAdd')">
                <button v-for="m in notShortcut" :key="m.id" type="button" class="btn s" :title="modeHint(m.id)" :aria-label="t('set.scAddOne', { x: modeLabel(m.id) })" @click="toggleShortcut(m.id)">+ {{ modeLabel(m.id) }}</button>
              </div>
            </div>
          </template>
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
      <!-- App & updates (C-27, C-52) -->
      <section id="updates">
        <div class="sh"><h2>{{ t("set.updates") }}</h2></div>
        <div class="card flush">
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("set.installed") }}</div>
              <div class="s"><bdi>{{ upd.current || version }}</bdi> · {{ kindLabel }}<template v-if="upd.build"> · {{ t("set.build", { b: upd.build }) }}</template></div></div>
            <button type="button" class="btn o s" :disabled="upd.checking || upd.downloading || webUpd.checking" @click="checkAny()">{{ t("set.checkNow") }}</button>
          </div>
          <div v-if="inApp" class="li" aria-live="polite">
            <Icon name="download" /><div class="grow"><div class="t">{{ updTitle }}</div>
              <div v-if="updHint" class="s">{{ updHint }}</div>
              <div v-if="upd.downloading" class="pbar" role="progressbar" :aria-label="t('set.progress')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="upd.progress != null ? pctOf(upd.progress) : undefined"><i :class="{ busy: upd.progress == null }" :style="upd.progress != null ? { width: pctOf(upd.progress) + '%' } : undefined"></i></div></div>
            <template v-if="upd.latest && !upd.checking">
              <button v-if="upd.mode === 'link'" type="button" class="btn s" @click="openUrl(upd.page)">{{ t("set.releasePage") }}</button>
              <button v-else-if="!upd.ready" type="button" class="btn s" :disabled="upd.downloading" @click="download(true)">{{ upd.downloading ? (upd.progress != null ? t("set.pct", { p: pctOf(upd.progress) }) : t("msg.downloading")) : t("set.download") }}</button>
              <button v-else type="button" class="btn s" @click="install()">{{ onDesktop ? t("set.restartUpdate") : t("set.install") }}</button>
            </template>
          </div>
          <div v-else class="li" aria-live="polite">
            <Icon name="download" /><div class="grow"><div class="t">{{ webTitle }}</div><div v-if="webHint" class="s">{{ webHint }}</div></div>
            <button v-if="webUpd.state === 'ready' && !webUpd.checking" type="button" class="btn s" @click="restartWeb()">{{ t("set.restart") }}</button>
          </div>
        </div>
        <!-- the web app / PWA: the browser looks for a new version whenever the app opens (that can't be switched off), and
             then as often as chosen here -->
        <div v-if="!inApp" class="card flush">
          <div class="li">
            <Icon name="history" /><div class="grow"><div class="t">{{ t("set.howOften") }}</div><div class="s">{{ t("set.howOftenWebHint") }}</div></div>
            <AppSelect :model-value="upd.every" :options="EVERY_OPTIONS" :title="t('set.howOften')" @update:model-value="(v: Every) => setEvery(v)" />
          </div>
        </div>
        <div v-if="inApp" class="card flush">
          <label class="li tg">
            <Icon name="check" /><div class="grow"><div class="t">{{ t("set.autoUpdate") }}</div><div class="s">{{ t("set.autoCheckHint") }}</div></div>
            <input :checked="upd.auto" type="checkbox" @change="setAuto(($event.target as HTMLInputElement).checked)" />
          </label>
          <!-- the rest only acts on what an automatic check finds, so it shows only while that is on (as in Motus) -->
          <div v-if="upd.auto" class="li">
            <Icon name="history" /><div class="grow"><div class="t">{{ t("set.howOften") }}</div><div class="s">{{ t("set.howOftenHint") }}</div></div>
            <AppSelect :model-value="upd.every" :options="EVERY_OPTIONS" :title="t('set.howOften')" @update:model-value="(v: Every) => setEvery(v)" />
          </div>
          <label v-if="upd.auto && upd.mode === 'install'" class="li tg">
            <Icon name="download" /><div class="grow"><div class="t">{{ t("set.autoDownload") }}</div><div class="s">{{ onDesktop ? t("set.autoDownloadDesktop") : t("set.autoDownloadAndroid") }}</div></div>
            <input :checked="upd.autoDownload" type="checkbox" @change="setAutoDownload(($event.target as HTMLInputElement).checked)" />
          </label>
          <label v-if="upd.auto && upd.autoDownload && upd.mode === 'install' && upd.canTellMetered" class="li tg">
            <Icon name="convert" /><div class="grow"><div class="t">{{ t("set.wifiOnly") }}</div><div class="s">{{ t("set.wifiOnlyHint") }}</div></div>
            <input :checked="upd.wifiOnly" type="checkbox" @change="setWifiOnly(($event.target as HTMLInputElement).checked)" />
          </label>
          <div v-if="isAndroid && upd.mode === 'install' && upd.notify && upd.notify !== 'granted'" class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("set.notify") }}</div><div class="s">{{ upd.notify === "denied" ? t("set.notifyBlocked") : t("set.notifyAsk") }}</div></div>
            <button v-if="upd.notify === 'prompt'" type="button" class="btn o s" @click="askNotify()">{{ t("set.allow") }}</button>
          </div>
        </div>
        <!-- in a browser, the apps are offered as in Motus ("Get the app"), as a link: the web app asks GitHub nothing -->
        <div v-if="!inApp" class="card flush">
          <div class="li">
            <Icon name="download" /><div class="grow"><div class="t">{{ t("set.getApp") }}</div><div class="s">{{ t("set.getAppHint") }}</div></div>
            <button type="button" class="btn s" @click="openUrl(REPO_URL + '/releases/latest')">{{ t("set.open") }}</button>
          </div>
        </div>
        <div class="card flush">
          <div v-if="inApp && upd.latest && upd.notes" class="li"><div class="grow"><div class="t">{{ t("set.whatsNewIn", { v: upd.latest }) }}</div><div class="s" style="white-space: pre-wrap">{{ upd.notes }}</div></div></div>
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("set.whatsNew") }}</div><div class="s">{{ t("set.whatsNewHint") }}</div></div>
            <button type="button" class="btn o s" @click="openUrl(REPO_URL + '/releases')">{{ t("set.open") }}</button>
          </div>
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">{{ t("set.onGithub") }}</div><div class="s">{{ t("set.onGithubHint") }}</div></div>
            <button type="button" class="btn o s" @click="openUrl(REPO_URL)">{{ t("set.open") }}</button>
          </div>
        </div>
        <p v-if="inApp" class="note">{{ t("set.updPrivacy") }}</p>
      </section>
      <!-- end App & updates -->
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

<style scoped>
/* the download's progress under its status line (desktop and Android); a moving bar while the size is unknown */
.pbar { height: 6px; margin-top: var(--lpy); border-radius: 3px; background: var(--s2); overflow: hidden; }
.pbar i { display: block; height: 100%; background: var(--acc); border-radius: inherit; transition: width .25s; }
.pbar i.busy { width: 30%; animation: pslide 1.2s ease-in-out infinite; }
@keyframes pslide { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
@media (prefers-reduced-motion: reduce) { .pbar i { transition: none; } .pbar i.busy { animation: none; width: 100%; opacity: .5; } }
/* App & updates has three cards: the gap between blocks */
#updates > .card + .card { margin-top: var(--spg); }
/* C-66: the shortcut rows sit under their switch, lined up with its text (past the icon); the modes to add wrap under
   their heading on a narrow screen */
/* an invisible copy of the toggle rows' icon, so these rows line up through the same icon slot and gap */
.scgap { visibility: hidden; }
.scli .ib:disabled { opacity: .35; }
.scadd { flex-wrap: wrap; }
.scpick { display: flex; flex-wrap: wrap; gap: calc(var(--hg) / 2); }
/* the privacy line under the cards: small print, the page's side inset */
.note { margin: var(--lpy) var(--cpx) 0; font-size: 12.5px; color: var(--tx2); }
</style>
