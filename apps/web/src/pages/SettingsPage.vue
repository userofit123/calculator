<script setup lang="ts">
// Settings: Appearance (the panel, and phone or computer layout), the calculator's own options (later units), and
// About with the privacy promise.
import { appearanceOpen } from "../core/ui";
import { layoutChoice, setLayout } from "../core/device";
import Icon from "../components/Icon.vue";

const version = import.meta.env.VITE_VERSION || "dev";
const LAYOUTS: [typeof layoutChoice.value, string][] = [["auto", "Auto"], ["phone", "Phone"], ["desktop", "Computer"]];
</script>

<template>
  <div class="page">
    <div class="ph"><div><h1>Settings</h1></div></div>
    <div class="stack">
      <section>
        <div class="sh first"><h2>Appearance</h2></div>
        <div class="card flush">
          <button type="button" class="li click" data-theme-open style="width:100%;border:0;background:none;text-align:start;font:inherit;color:inherit" @click.stop="appearanceOpen = true">
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
        <div class="card"><div class="empty sm"><b>Coming next</b>Decimal places, number format, angle units and the currency-rate refresh.</div></div>
      </section>
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
