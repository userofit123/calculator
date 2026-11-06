// German: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./de/common";
import { msg } from "./de/msg";
import { calc } from "./de/calc";
import { settings } from "./de/settings";
import { convert } from "./de/convert";
import { history } from "./de/history";
import { date } from "./de/date";
import { every } from "./de/every";
import { tip } from "./de/tip";
import { fin } from "./de/fin";
import { prog } from "./de/prog";
import { kbd } from "./de/kbd";
import { look } from "./de/look";
import { UNITS } from "./de/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} Jahr", other: "{n} Jahre" },
    month: { one: "{n} Monat", other: "{n} Monate" },
    week: { one: "{n} Woche", other: "{n} Wochen" },
    day: { one: "{n} Tag", other: "{n} Tage" },
    hour: { one: "{n} Stunde", other: "{n} Stunden" },
    minute: { one: "{n} Minute", other: "{n} Minuten" },
    second: { one: "{n} Sekunde", other: "{n} Sekunden" },
  },
} satisfies LangPack;
