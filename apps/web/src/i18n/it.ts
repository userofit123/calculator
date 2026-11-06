// Italian: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./it/common";
import { msg } from "./it/msg";
import { calc } from "./it/calc";
import { settings } from "./it/settings";
import { convert } from "./it/convert";
import { history } from "./it/history";
import { date } from "./it/date";
import { every } from "./it/every";
import { tip } from "./it/tip";
import { fin } from "./it/fin";
import { prog } from "./it/prog";
import { kbd } from "./it/kbd";
import { look } from "./it/look";
import { UNITS } from "./it/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} anno", many: "{n} anni", other: "{n} anni" },
    month: { one: "{n} mese", many: "{n} mesi", other: "{n} mesi" },
    week: { one: "{n} settimana", many: "{n} settimane", other: "{n} settimane" },
    day: { one: "{n} giorno", many: "{n} giorni", other: "{n} giorni" },
    hour: { one: "{n} ora", many: "{n} ore", other: "{n} ore" },
    minute: { one: "{n} minuto", many: "{n} minuti", other: "{n} minuti" },
    second: { one: "{n} secondo", many: "{n} secondi", other: "{n} secondi" },
  },
} satisfies LangPack;
