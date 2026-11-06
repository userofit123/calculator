// Dutch: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./nl/common";
import { msg } from "./nl/msg";
import { calc } from "./nl/calc";
import { settings } from "./nl/settings";
import { convert } from "./nl/convert";
import { history } from "./nl/history";
import { date } from "./nl/date";
import { every } from "./nl/every";
import { tip } from "./nl/tip";
import { fin } from "./nl/fin";
import { prog } from "./nl/prog";
import { kbd } from "./nl/kbd";
import { look } from "./nl/look";
import { UNITS } from "./nl/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} jaar", other: "{n} jaar" },
    month: { one: "{n} maand", other: "{n} maanden" },
    week: { one: "{n} week", other: "{n} weken" },
    day: { one: "{n} dag", other: "{n} dagen" },
    hour: { one: "{n} uur", other: "{n} uur" },
    minute: { one: "{n} minuut", other: "{n} minuten" },
    second: { one: "{n} seconde", other: "{n} seconden" },
  },
} satisfies LangPack;
