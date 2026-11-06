// Turkish: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./tr/common";
import { msg } from "./tr/msg";
import { calc } from "./tr/calc";
import { settings } from "./tr/settings";
import { convert } from "./tr/convert";
import { history } from "./tr/history";
import { date } from "./tr/date";
import { every } from "./tr/every";
import { tip } from "./tr/tip";
import { fin } from "./tr/fin";
import { prog } from "./tr/prog";
import { kbd } from "./tr/kbd";
import { look } from "./tr/look";
import { UNITS } from "./tr/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} yıl", other: "{n} yıl" },
    month: { one: "{n} ay", other: "{n} ay" },
    week: { one: "{n} hafta", other: "{n} hafta" },
    day: { one: "{n} gün", other: "{n} gün" },
    hour: { one: "{n} saat", other: "{n} saat" },
    minute: { one: "{n} dakika", other: "{n} dakika" },
    second: { one: "{n} saniye", other: "{n} saniye" },
  },
} satisfies LangPack;
