// Portuguese (Brazil): a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./pt/common";
import { msg } from "./pt/msg";
import { calc } from "./pt/calc";
import { settings } from "./pt/settings";
import { convert } from "./pt/convert";
import { history } from "./pt/history";
import { date } from "./pt/date";
import { every } from "./pt/every";
import { tip } from "./pt/tip";
import { fin } from "./pt/fin";
import { prog } from "./pt/prog";
import { kbd } from "./pt/kbd";
import { look } from "./pt/look";
import { UNITS } from "./pt/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} ano", many: "{n} de anos", other: "{n} anos" },
    month: { one: "{n} mês", many: "{n} de meses", other: "{n} meses" },
    week: { one: "{n} semana", many: "{n} de semanas", other: "{n} semanas" },
    day: { one: "{n} dia", many: "{n} de dias", other: "{n} dias" },
    hour: { one: "{n} hora", many: "{n} de horas", other: "{n} horas" },
    minute: { one: "{n} minuto", many: "{n} de minutos", other: "{n} minutos" },
    second: { one: "{n} segundo", many: "{n} de segundos", other: "{n} segundos" },
  },
} satisfies LangPack;
