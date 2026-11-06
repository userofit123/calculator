// French: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./fr/common";
import { msg } from "./fr/msg";
import { calc } from "./fr/calc";
import { settings } from "./fr/settings";
import { convert } from "./fr/convert";
import { history } from "./fr/history";
import { date } from "./fr/date";
import { every } from "./fr/every";
import { tip } from "./fr/tip";
import { fin } from "./fr/fin";
import { prog } from "./fr/prog";
import { kbd } from "./fr/kbd";
import { look } from "./fr/look";
import { UNITS } from "./fr/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} an", many: "{n} d'années", other: "{n} ans" },
    month: { one: "{n} mois", many: "{n} de mois", other: "{n} mois" },
    week: { one: "{n} semaine", many: "{n} de semaines", other: "{n} semaines" },
    day: { one: "{n} jour", many: "{n} de jours", other: "{n} jours" },
    hour: { one: "{n} heure", many: "{n} d'heures", other: "{n} heures" },
    minute: { one: "{n} minute", many: "{n} de minutes", other: "{n} minutes" },
    second: { one: "{n} seconde", many: "{n} de secondes", other: "{n} secondes" },
  },
} satisfies LangPack;
