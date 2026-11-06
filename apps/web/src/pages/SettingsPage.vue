<script setup lang="ts">
// Settings: Appearance (the panel, and phone or computer layout), the calculator's own options (angles, decimals,
// number format, decimal mark, grouping; later units), and
// About with the privacy promise.
import { appearanceOpen } from "../core/ui";
import { layoutChoice, setLayout } from "../core/device";
import { settings, ANGLES, type CalcSettings } from "../core/calc";
import Icon from "../components/Icon.vue";
import AppSelect from "../components/AppSelect.vue";
// --- Converter / Currency rates (C-14) ---
import { ECB_SOURCE } from "@calc/core";
import { rates, rateDate, refreshRates } from "../core/rates";
// --- end Converter / Currency rates ---

const version = import.meta.env.VITE_VERSION || "dev";
const DECIMALS = Array.from({ length: 16 }, (_, i) => ({ value: i, label: String(i) }));
const FORMATS: [CalcSettings["format"], string][] = [["auto", "Auto"], ["fixed", "Fixed"], ["sci", "Sci"], ["eng", "Eng"]];
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
            <div class="seg"><button v-for="[v, l] in LAYOUTS" :key="v" type="button" :class="{ on: layoutChoice === v }" @click="setLayout(v)">{{ l }}</button></div>
          </div>
        </div>
      </section>
      <section>
        <div class="sh"><h2>Calculator</h2></div>
        <div class="card flush">
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Angle unit</div><div class="s">For sin, cos, tan and their inverses (Advanced)</div></div>
            <div class="seg"><button v-for="a in ANGLES" :key="a.id" type="button" :class="{ on: settings.angle === a.id }" @click="settings.angle = a.id">{{ a.label }}</button></div>
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Decimal places</div><div class="s">The most digits shown after the decimal point</div></div>
            <AppSelect v-model="settings.decimals" :options="DECIMALS" title="Decimal places" />
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Number format</div><div class="s">Auto switches to ×10ⁿ for very large or small numbers</div></div>
            <div class="seg"><button v-for="[v, l] in FORMATS" :key="v" type="button" :class="{ on: settings.format === v }" @click="settings.format = v">{{ l }}</button></div>
          </div>
          <div class="li">
            <Icon name="calc" /><div class="grow"><div class="t">Decimal mark</div><div class="s">{{ settings.decimalMark === "," ? "1.234,5" : "1,234.5" }}</div></div>
            <div class="seg"><button v-for="m in MARKS" :key="m" type="button" :class="{ on: settings.decimalMark === m }" @click="settings.decimalMark = m">{{ m === "." ? "Point" : "Comma" }}</button></div>
          </div>
          <label class="li tg">
            <Icon name="calc" /><div class="grow"><div class="t">Group thousands</div><div class="s">{{ settings.decimalMark === "," ? "1.000.000" : "1,000,000" }}</div></div>
            <input v-model="settings.thousands" type="checkbox" />
          </label>
        </div>
      </section>
      <!-- Converter / Currency rates (C-14) -->
      <section>
        <div class="sh"><h2>Currency rates</h2></div>
        <div class="card flush">
          <label class="li tg">
            <Icon name="convert" /><div class="grow"><div class="t">Update currency rates online</div><div class="s">Downloads the latest
              rates straight from the European Central Bank, a few times a day at most, while the converter is open. No account,
              no cookies, nothing about you is sent. Off: no network requests at all; the converter keeps using the rates it has.</div></div>
            <input v-model="rates.online" type="checkbox" />
          </label>
          <div class="li">
            <Icon name="history" /><div class="grow"><div class="t">Rates of {{ rateDate(rates.set.date) }}</div>
              <div class="s">{{ ECB_SOURCE }} · {{ rates.loading ? "Checking..." : rates.error ? rates.error
                : rates.set.fetchedAt ? `downloaded ${new Date(rates.set.fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "came with the app" }}</div></div>
            <button type="button" class="btn o s" :disabled="!rates.online || rates.loading" @click="refreshRates()">Refresh now</button>
          </div>
        </div>
      </section>
      <!-- end Converter / Currency rates -->
      <section>
        <div class="sh"><h2>About</h2></div>
        <div class="card about">
          <p><b>Calculator</b> · version {{ version }}</p>
          <p>Private from the start: no account, no tracking, no analytics. Everything you type stays on this device. Nothing
            leaves it, except the optional currency-rate refresh (public rates, no identifiers), which you can switch off.</p>
          <p>Source and licence: github.com/userofit123/calculator (PolyForm Noncommercial 1.0.0).</p>
        </div>
      </section>
    </div>
  </div>
</template>
