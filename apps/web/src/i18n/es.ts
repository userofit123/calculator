// Spanish: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./es/common";
import { msg } from "./es/msg";
import { calc } from "./es/calc";
import { settings } from "./es/settings";
import { convert } from "./es/convert";
import { history } from "./es/history";
import { date } from "./es/date";
import { every } from "./es/every";
import { tip } from "./es/tip";
import { fin } from "./es/fin";
import { prog } from "./es/prog";
import { kbd } from "./es/kbd";
import { look } from "./es/look";
import { UNITS } from "./es/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} año", many: "{n} años", other: "{n} años" },
    month: { one: "{n} mes", many: "{n} meses", other: "{n} meses" },
    week: { one: "{n} semana", many: "{n} semanas", other: "{n} semanas" },
    day: { one: "{n} día", many: "{n} días", other: "{n} días" },
    hour: { one: "{n} hora", many: "{n} horas", other: "{n} horas" },
    minute: { one: "{n} minuto", many: "{n} minutos", other: "{n} minutos" },
    second: { one: "{n} segundo", many: "{n} segundos", other: "{n} segundos" },
  },
} satisfies LangPack;
