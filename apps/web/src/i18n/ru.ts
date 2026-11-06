// Russian: a chunk of its own, loaded only when it is chosen (i18n/langs.ts, core/i18n.ts).
import type { Key } from "./en";
import type { LangPack } from "./langs";
import { common } from "./ru/common";
import { msg } from "./ru/msg";
import { calc } from "./ru/calc";
import { settings } from "./ru/settings";
import { convert } from "./ru/convert";
import { history } from "./ru/history";
import { date } from "./ru/date";
import { every } from "./ru/every";
import { tip } from "./ru/tip";
import { fin } from "./ru/fin";
import { prog } from "./ru/prog";
import { kbd } from "./ru/kbd";
import { look } from "./ru/look";
import { UNITS } from "./ru/units";

const dict: Record<Key, string> = { ...common, ...msg, ...calc, ...settings, ...convert, ...history, ...date, ...every, ...tip, ...fin, ...prog, ...kbd, ...look };

export default {
  dict,
  units: UNITS,
  count: {
    year: { one: "{n} год", few: "{n} года", many: "{n} лет", other: "{n} года" },
    month: { one: "{n} месяц", few: "{n} месяца", many: "{n} месяцев", other: "{n} месяца" },
    week: { one: "{n} неделя", few: "{n} недели", many: "{n} недель", other: "{n} недели" },
    day: { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" },
    hour: { one: "{n} час", few: "{n} часа", many: "{n} часов", other: "{n} часа" },
    minute: { one: "{n} минута", few: "{n} минуты", many: "{n} минут", other: "{n} минуты" },
    second: { one: "{n} секунда", few: "{n} секунды", many: "{n} секунд", other: "{n} секунды" },
  },
} satisfies LangPack;
