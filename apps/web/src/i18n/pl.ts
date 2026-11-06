// Polish: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./pl/common";
import { msg } from "./pl/msg";
import { calc } from "./pl/calc";
import { settings } from "./pl/settings";
import { convert } from "./pl/convert";
import { history } from "./pl/history";
import { date } from "./pl/date";
import { every } from "./pl/every";
import { tip } from "./pl/tip";
import { fin } from "./pl/fin";
import { prog } from "./pl/prog";
import { kbd } from "./pl/kbd";
import { look } from "./pl/look";
import { UNITS } from "./pl/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} rok", few: "{n} lata", many: "{n} lat", other: "{n} roku" },
    month: { one: "{n} miesiąc", few: "{n} miesiące", many: "{n} miesięcy", other: "{n} miesiąca" },
    week: { one: "{n} tydzień", few: "{n} tygodnie", many: "{n} tygodni", other: "{n} tygodnia" },
    day: { one: "{n} dzień", few: "{n} dni", many: "{n} dni", other: "{n} dnia" },
    hour: { one: "{n} godzina", few: "{n} godziny", many: "{n} godzin", other: "{n} godziny" },
    minute: { one: "{n} minuta", few: "{n} minuty", many: "{n} minut", other: "{n} minuty" },
    second: { one: "{n} sekunda", few: "{n} sekundy", many: "{n} sekund", other: "{n} sekundy" },
  },
} satisfies LangPack;
