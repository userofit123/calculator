<script setup lang="ts">
// Settings: Appearance (the panel, and phone or computer layout), the calculator's own options (angles, decimals,
// number format, decimal mark, grouping; later units), and
// About with the privacy promise.
import { appearanceOpen } from "../core/ui";
import { layoutChoice, setLayout } from "../core/device";
import { settings, ANGLES, FORMATS } from "../core/calc";
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
import { ECB_SOURCE, sourceDayOf } from "@calc/core";
import { rates, rateDate, refreshRates } from "../core/rates";
// --- end Converter / Currency rates ---

// --- Updates (C-27) ---
import { appUpdates, upd, checkNow, download, install, setAuto } from "../core/appUpdate";
const inApp = appUpdates();
const onDesktop = !!(globalThis as { calcUpdate?: unknown }).calcUpdate;
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
/** the release page (deb/rpm): a link, which the desktop app opens in the browser (its allowlist has this repository) */
const openPage = () => { if (upd.page) window.open(upd.page, "_blank", "noopener"); };
// --- end Updates ---

const version = import.meta.env.VITE_VERSION || "dev";
const DECIMALS = Array.from({ length: 16 }, (_, i) => ({ value: i, label: String(i) }));
const FORMAT_OPTIONS = FORMATS.map((f) => ({ value: f.id, label: f.label }));
const MARKS = [".", ","] as const;
const LAYOUTS: [typeof layoutChoice.value, string][] = [["auto", "Auto"], ["phone", "Phone"], ["desktop", "Computer"]];
</script>

<template>
  <div class="page">
    <div class="ph"><div><h1>Settings</h1></div></div>
    <div class="stack">
      <section>
        <div class="sh first"><h2>Appearance</h2></div>
        <div class="card flush">
          <button type="button" class="li click lib" data-theme-open @click.stop="appearanceOpen = true">
            <Icon name="palette" /><div class="grow"><div class="t">Appearance</div><div class="s">Colours, background, texture, corners, keys, density and font</div></div><Icon name="right" />
          </button>
          <div class="li">
            <Icon name="device" /><div class="grow"><div class="t">Layout</div><div class="s">Auto picks the phone layout on narrow or touch screens</div></div>
            <div class="seg"><button v-for="[v, l] in LAYOUTS" :key="v" type="button" :class="{ on: layoutChoice === v }" :aria-pressed="layoutChoice === v" @click="setLayout(v)">{{ l }}</button></div>
          </div>
        </div>
      </section>
      <section>
        <div class="sh"><h2>Calculator</h2></div>
        <div class="card flush">
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Angle unit</div><div class="s">For sin, cos, tan and their inverses (Advanced)</div></div>
            <div class="seg"><button v-for="a in ANGLES" :key="a.id" type="button" :class="{ on: settings.angle === a.id }" :aria-pressed="settings.angle === a.id" @click="settings.angle = a.id">{{ a.label }}</button></div>
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Decimal places</div><div class="s">The most digits shown after the decimal point</div></div>
            <AppSelect v-model="settings.decimals" :options="DECIMALS" title="Decimal places" />
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Number format</div><div class="s">{{ FORMATS.find((f) => f.id === settings.format)?.hint }} · also on the calculator's display</div></div>
            <AppSelect v-model="settings.format" :options="FORMAT_OPTIONS" title="Number format" />
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Decimal mark</div><div class="s">{{ settings.decimalMark === "," ? "1.234,5" : "1,234.5" }}</div></div>
            <div class="seg"><button v-for="m in MARKS" :key="m" type="button" :class="{ on: settings.decimalMark === m }" :aria-pressed="settings.decimalMark === m" @click="settings.decimalMark = m">{{ m === "." ? "Point" : "Comma" }}</button></div>
          </div>
          <label class="li tg">
            <Icon name="calc" /><div class="grow"><div class="t">Group thousands</div><div class="s">{{ settings.decimalMark === "," ? "1.000.000" : "1,000,000" }}</div></div>
            <input v-model="settings.thousands" type="checkbox" />
          </label>
          <label class="li tg">
            <Icon name="calc" /><div class="grow"><div class="t">Everyday helpers</div><div class="s">An Everyday mode: percent · discount · tip and split · VAT</div></div>
            <input v-model="settings.everyday" type="checkbox" />
          </label>
        </div>
      </section>
      <!-- History (C-26) -->
      <section>
        <div class="sh"><h2>History</h2></div>
        <div class="card flush">
          <label class="li tg">
            <Icon name="history" /><div class="grow"><div class="t">Keep history</div><div class="s">Off: nothing new is saved. Pinned entries and the 200-entry list stay on this device only.</div></div>
            <input :checked="histPrefs.keep" type="checkbox" @change="keepChange" />
          </label>
        </div>
        <Sheet v-if="askOff" title="Stop keeping history" @close="askOff = false">
          <p>Keep the {{ history.length }} saved calculations, or delete them?</p>
          <div class="seg" style="margin-top: var(--hg)"><button type="button" @click="turnOff(false)">Keep them</button><button type="button" @click="turnOff(true)">Delete them</button></div>
        </Sheet>
      </section>
      <!-- end History -->
      <!-- Converter / Currency rates (C-14) -->
      <section>
        <div class="sh"><h2>Currency rates</h2></div>
        <div class="card flush">
          <label class="li tg">
            <Icon name="convert" /><div class="grow"><div class="t">Update currency rates online</div><div class="s">Downloads the latest
              rates straight from the European Central Bank, and for the Ukrainian hryvnia and the Argentine peso from the National
              Bank of Ukraine and the Central Bank of Argentina (official sources only): when the converter's Currency category is opened, when the device comes
              back online, when you switch this on, and on Refresh now. On its own at most every 4 hours; after a failed try it waits
              at least 30 minutes (then longer). No account, no cookies, nothing about you is sent. Off: no network requests at all;
              the converter keeps using the rates it has.</div></div>
            <input v-model="rates.online" type="checkbox" />
          </label>
          <div class="li">
            <Icon name="history" /><div class="grow"><div class="t">Rates of {{ rateDate(sourceDayOf(rates.set, "ecb") || rates.set.date) }}</div>
              <div class="s">{{ ECB_SOURCE }} · {{ rates.loading ? "Checking..." : rates.error ? rates.error
                : rates.set.fetchedAt ? `downloaded ${new Date(rates.set.fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "came with the app" }}</div></div>
            <button type="button" class="btn o s" :disabled="!rates.online || rates.loading" @click="refreshRates()">Refresh now</button>
          </div>
        </div>
      </section>
      <!-- end Converter / Currency rates -->
      <!-- Updates (C-27) -->
      <section id="updates">
        <div class="sh"><h2>Updates</h2></div>
        <div v-if="inApp" class="card flush">
          <label class="li tg">
            <Icon name="download" /><div class="grow"><div class="t">Check for updates automatically</div><div class="s">Asks GitHub
              whether a newer version is out: shortly after the app opens and then every 6 hours, at most. Only that question is
              sent, with nothing about you or this device. Nothing is downloaded or installed until you choose. Off: no checks,
              except Check now.</div></div>
            <input :checked="upd.auto" type="checkbox" @change="setAuto(($event.target as HTMLInputElement).checked)" />
          </label>
          <div class="li">
            <Icon name="info" /><div class="grow"><div class="t">Version {{ upd.current || version }}</div>
              <div class="s">{{ upd.checking ? "Checking..." : upd.error ? upd.error : upd.status || (upd.lastCheck ? "Up to date" : "Not checked yet") }}{{ upd.lastCheck && !upd.checking ? ` · checked ${when(upd.lastCheck)}` : "" }}</div></div>
            <button type="button" class="btn o s" :disabled="upd.checking || upd.downloading" @click="checkNow()">Check now</button>
          </div>
          <template v-if="upd.latest">
            <div class="li">
              <Icon name="download" /><div class="grow"><div class="t">Version {{ upd.latest }}</div>
                <div class="s">{{ upd.mode === "link" ? "Download the new package from the release page and install it like the first time" : upd.ready ? "Downloaded and checked" : upd.downloading ? upd.status : "Downloads from GitHub, then checks the file before it is installed" }}</div></div>
              <button v-if="upd.mode === 'link'" type="button" class="btn s" @click="openPage">Release page</button>
              <button v-else-if="!upd.ready" type="button" class="btn s" :disabled="upd.downloading" @click="download()">{{ upd.downloading ? (upd.progress != null ? Math.round(upd.progress * 100) + "%" : "Downloading") : "Download" }}</button>
              <button v-else type="button" class="btn s" @click="install()">{{ onDesktop ? "Restart and install" : "Install" }}</button>
            </div>
            <div v-if="upd.notes" class="li"><div class="grow"><div class="t">What's new</div><div class="s" style="white-space: pre-wrap">{{ upd.notes }}</div></div></div>
          </template>
        </div>
        <div v-else class="card about"><p>Updates come automatically: a new version loads the next time you open the app.</p></div>
      </section>
      <!-- end Updates -->
      <section>
        <div class="sh"><h2>About</h2></div>
        <div class="card about">
          <p><b>Calculator</b> · version {{ version }}</p>
          <p>Private from the start: no account, no tracking, no analytics. Everything you type stays on this device. Nothing
            leaves it, except the optional currency-rate refresh (public rates, no identifiers) and, in the desktop and Android
            apps, the optional update check (one question to GitHub, no identifiers); both can be switched off.</p>
          <p>Source and licence: github.com/userofit123/calculator (PolyForm Noncommercial 1.0.0).</p>
        </div>
      </section>
    </div>
  </div>
</template>
